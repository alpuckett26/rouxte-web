import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchOutreach, unsubscribePostUrl, type SendFn } from "@/lib/outreach/dispatch";
import { FROM, getResend } from "@/lib/email/resend";

/**
 * GET /api/cron/outreach-dispatch — the thing that makes the second and third
 * touch happen (rouxte-web#18, item 1).
 *
 * Auth: Bearer CRON_SECRET, same as every other cron here.
 *
 * Query:
 *   ?dry_run=1   evaluate every due touch and WRITE NOTHING, send nothing.
 *   ?limit=N     per-run cap (default 50).
 *
 * DEFAULTS TO DRY RUN when RESEND_API_KEY is absent, rather than reporting a
 * clean run that sent nothing. A cron that looks green while silently sending
 * zero email is the same defect as the backfill's silent zero, and this repo
 * has already paid for that one once.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = process.env.ANSWERS_TARGET_ORG_ID;
  if (!orgId) {
    return NextResponse.json({ error: "ANSWERS_TARGET_ORG_ID is not set" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!appUrl) {
    // No app URL means no unsubscribe link, and an outreach email with no way
    // out is the one thing we said we would never send.
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL is not set — refusing to send outreach with no unsubscribe link" },
      { status: 500 },
    );
  }

  const channelConfigured = Boolean(process.env.RESEND_API_KEY);
  const requestedDryRun = request.nextUrl.searchParams.get("dry_run") === "1";
  const dryRun = requestedDryRun || !channelConfigured;
  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;

  const send: SendFn = async (req) => {
    try {
      const { data, error } = await getResend().emails.send({
        from: FROM,
        to: req.to,
        subject: req.subject,
        text: req.body,
        headers: {
          // RFC 8058. Mailbox providers surface a native unsubscribe button off
          // this, which is what keeps a recipient from reaching for the spam
          // button instead — and the spam button is what burns the domain. The
          // token comes from the SendRequest, so this header and the footer
          // link can never resolve to different people.
          "List-Unsubscribe": `<${unsubscribePostUrl(appUrl, req.unsubscribeToken)}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      if (error) return { ok: false, error: error.message ?? String(error) };
      return { ok: true, providerMessageId: data?.id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  };

  const admin = createAdminClient();
  const summary = await dispatchOutreach(admin, {
    orgId,
    limit,
    dryRun,
    send,
    appUrl,
    channelConfigured,
  });

  const warnings = [...summary.warnings];
  if (!channelConfigured) {
    warnings.push(
      "RESEND_API_KEY is not set — this run was forced to DRY RUN and sent nothing. HUMAN GATE: the key must be in the deploy env before any outreach leaves.",
    );
  }

  const result = { ...summary, warnings };
  console.log("[outreach-dispatch]", JSON.stringify(result));
  return NextResponse.json(result, { status: summary.ok ? 200 : 500 });
}
