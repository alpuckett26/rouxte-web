import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/api";

/**
 * POST /api/ai/parse-comp-guide
 *
 * Body: { text: string }  — the raw text of a dealer's commission guide,
 *                            pasted or extracted from a PDF on the client.
 *
 * Returns: { rows: Array<{ carrier, product, rep_payout_cents,
 *                          manager_override_cents, lead_override_cents }> }
 *
 * Used by the admin-setup wizard's comp-guide step. The admin reviews and
 * can edit before saving — we do not blindly trust the parse.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { text?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const text = (body.text ?? "").trim();
  if (text.length < 20) {
    return NextResponse.json({ error: "Paste more of your comp sheet so I can parse it." }, { status: 400 });
  }
  if (text.length > 50_000) {
    return NextResponse.json({ error: "Comp sheet too long — trim to under 50k chars." }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI is not configured on this server" }, { status: 503 });
  }

  const system = `You extract structured compensation data from door-to-door telecom dealer commission sheets.

Output JSON ONLY in this exact shape — no prose, no markdown fences:
{
  "rows": [
    {
      "carrier": "AT&T Fiber" | "Frontier Fiber" | "Spectrum" | "Verizon Fios" | "Verizon 5G Home" | "T-Mobile Home Internet" | "Starlink" | "DIRECTV" | "Other",
      "product": "string describing speed tier or package",
      "rep_payout_cents": integer (rep payout in CENTS),
      "manager_override_cents": integer (manager override per sale in CENTS, 0 if not specified),
      "lead_override_cents": integer (team-lead override per sale in CENTS, 0 if not specified)
    }
  ]
}

Rules:
- Convert dollar amounts to cents (e.g. "$75" -> 7500).
- If a number is ambiguous, prefer the rep_payout. Use 0 for missing overrides.
- Skip non-commission rows (bonuses, SPIFFs, contests) unless they describe a per-sale payout.
- Group by carrier + product. One row per distinct (carrier, product) combination.
- If carrier is not in the list above, use "Other".
- Return at most 30 rows.`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: text }],
    });

    const raw = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    // Defensive parse — Claude is told to return JSON-only but we strip code fences just in case
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    let parsed: unknown;
    try { parsed = JSON.parse(jsonStr); }
    catch {
      return NextResponse.json({ error: "Could not parse comp sheet — try pasting cleaner text" }, { status: 422 });
    }

    const rows = (parsed as { rows?: unknown[] }).rows ?? [];
    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: "AI returned malformed result" }, { status: 422 });
    }

    type CompRow = {
      carrier: string;
      product: string;
      rep_payout_cents: number;
      manager_override_cents: number;
      lead_override_cents: number;
    };

    const cleaned: CompRow[] = rows
      .map((r) => {
        const row = r as Record<string, unknown>;
        return {
          carrier: typeof row.carrier === "string" ? row.carrier : "Other",
          product: typeof row.product === "string" ? row.product : "",
          rep_payout_cents: typeof row.rep_payout_cents === "number" ? Math.round(row.rep_payout_cents) : 0,
          manager_override_cents: typeof row.manager_override_cents === "number" ? Math.round(row.manager_override_cents) : 0,
          lead_override_cents: typeof row.lead_override_cents === "number" ? Math.round(row.lead_override_cents) : 0,
        };
      })
      .filter((r) => r.product.length > 0 && r.rep_payout_cents > 0)
      .slice(0, 30);

    return NextResponse.json({ rows: cleaned });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI parse failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
