import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Monthly cron — refreshes global competitor_intel rows (org_id IS NULL).
 *
 * Calls Claude with the web_search tool to look up each competitor's current
 * published plans and promos, then applies a silent outlier filter (rows
 * whose price moves > 2x or < 0.5x of the existing value are skipped) before
 * upserting. Org-specific competitor rows are not touched.
 *
 * Manual trigger:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://rouxte.com/api/cron/competitor-refresh
 */

interface PlanRefresh {
  competitor: string;
  plan_name: string;
  monthly_price: number | null;
  download_mbps: number | null;
  upload_mbps: number | null;
  contract_required: boolean;
  data_cap_gb: number | null;
  current_promo: string | null;
  source_url: string | null;
}

const REFRESH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["plans"],
  properties: {
    plans: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "competitor",
          "plan_name",
          "monthly_price",
          "download_mbps",
          "upload_mbps",
          "contract_required",
          "data_cap_gb",
          "current_promo",
          "source_url",
        ],
        properties: {
          competitor: { type: "string" },
          plan_name: { type: "string" },
          monthly_price: { type: ["number", "null"] },
          download_mbps: { type: ["integer", "null"] },
          upload_mbps: { type: ["integer", "null"] },
          contract_required: { type: "boolean" },
          data_cap_gb: { type: ["integer", "null"] },
          current_promo: { type: ["string", "null"] },
          source_url: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = new Date().toISOString();

  // 1. Fetch the global baseline rows. Skip AT&T (our product, not a competitor).
  const { data: existing, error: fetchErr } = await admin
    .from("competitor_intel")
    .select("id, competitor, plan_name, monthly_price")
    .is("org_id", null)
    .eq("active", true);
  if (fetchErr || !existing) {
    return NextResponse.json({ error: fetchErr?.message ?? "fetch failed" }, { status: 500 });
  }

  const refreshable = existing.filter((r) => !/^at&t/i.test(r.competitor));
  const competitors = [...new Set(refreshable.map((r) => r.competitor))];
  if (competitors.length === 0) {
    return NextResponse.json({ ok: true, message: "No competitors to refresh" });
  }

  // 2. Single Claude call with web_search. Constrains output to the JSON schema.
  const anthropic = new Anthropic();
  const prompt = `Look up the CURRENT published residential internet plans and promotional offers for these providers in the United States (national/standard pricing for new customers where applicable):

${competitors.map((c) => `- ${c}`).join("\n")}

For each provider, return its currently-published plan tiers with:
- plan_name (as listed on their site, e.g. "Internet Gig (1 Gbps)")
- monthly_price in USD (new-customer promo rate if applicable; the headline price they advertise)
- download_mbps and upload_mbps
- contract_required (boolean)
- data_cap_gb (null if unlimited)
- current_promo (any active offer like "$300 reward card", "free installation", "Netflix included" — null if none)
- source_url (the page you read it from)

Be conservative. If a value isn't published clearly or you're not confident, use null. Don't guess. Focus on the providers' own websites (e.g. spectrum.com, xfinity.com, cox.com, t-mobile.com, verizon.com).`;

  let llmResponse: Anthropic.Messages.Message;
  try {
    llmResponse = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      tools: [{ type: "web_search_20260209", name: "web_search" }],
      output_config: { format: { type: "json_schema", schema: REFRESH_SCHEMA } },
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    await admin.from("competitor_refresh_log").insert({
      competitors_queried: competitors,
      error_message: `LLM call failed: ${message}`,
    });
    return NextResponse.json({ error: "LLM call failed", details: message }, { status: 500 });
  }

  if (llmResponse.stop_reason !== "end_turn") {
    const reason = `Unexpected stop_reason: ${llmResponse.stop_reason}`;
    await admin.from("competitor_refresh_log").insert({
      competitors_queried: competitors,
      error_message: reason,
      total_tokens_input: llmResponse.usage.input_tokens,
      total_tokens_output: llmResponse.usage.output_tokens,
    });
    return NextResponse.json({ error: reason }, { status: 500 });
  }

  // 3. Parse the JSON-constrained text output.
  const text = llmResponse.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let parsed: { plans: PlanRefresh[] };
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "parse failed";
    await admin.from("competitor_refresh_log").insert({
      competitors_queried: competitors,
      error_message: `JSON parse failed: ${detail}`,
      total_tokens_input: llmResponse.usage.input_tokens,
      total_tokens_output: llmResponse.usage.output_tokens,
    });
    return NextResponse.json({ error: "JSON parse failed", details: detail }, { status: 500 });
  }

  // 4. Apply updates with silent outlier filter.
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const fresh of parsed.plans) {
    const match = existing.find(
      (r) => r.competitor === fresh.competitor && r.plan_name === fresh.plan_name,
    );

    if (match) {
      // Outlier guard: a price that doubles or halves vs current is almost
      // always a hallucination or a different plan tier with the same name.
      if (
        match.monthly_price != null &&
        fresh.monthly_price != null &&
        (fresh.monthly_price > match.monthly_price * 2 ||
          fresh.monthly_price < match.monthly_price * 0.5)
      ) {
        skipped++;
        continue;
      }
      const { error: updErr } = await admin
        .from("competitor_intel")
        .update({
          monthly_price: fresh.monthly_price,
          download_mbps: fresh.download_mbps,
          upload_mbps: fresh.upload_mbps,
          contract_required: fresh.contract_required,
          data_cap_gb: fresh.data_cap_gb,
          current_promo: fresh.current_promo,
          source_url: fresh.source_url,
          last_refreshed_at: startedAt,
          updated_at: startedAt,
        })
        .eq("id", match.id);
      if (!updErr) updated++;
    } else {
      const { error: insErr } = await admin.from("competitor_intel").insert({
        org_id: null,
        competitor: fresh.competitor,
        plan_name: fresh.plan_name,
        monthly_price: fresh.monthly_price,
        download_mbps: fresh.download_mbps,
        upload_mbps: fresh.upload_mbps,
        contract_required: fresh.contract_required,
        data_cap_gb: fresh.data_cap_gb,
        current_promo: fresh.current_promo,
        source_url: fresh.source_url,
        last_refreshed_at: startedAt,
        active: true,
      });
      if (!insErr) inserted++;
    }
  }

  // 5. Log the run.
  await admin.from("competitor_refresh_log").insert({
    competitors_queried: competitors,
    rows_inserted: inserted,
    rows_updated: updated,
    rows_skipped_outlier: skipped,
    total_tokens_input: llmResponse.usage.input_tokens,
    total_tokens_output: llmResponse.usage.output_tokens,
  });

  return NextResponse.json({
    ok: true,
    competitors_queried: competitors,
    rows_inserted: inserted,
    rows_updated: updated,
    rows_skipped_outlier: skipped,
  });
}
