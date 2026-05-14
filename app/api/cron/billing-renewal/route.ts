import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeCardOnFile } from "@/lib/billing/square-subscriptions";
import { getTier } from "@/lib/billing/tiers";

/**
 * GET /api/cron/billing-renewal
 * Vercel cron — daily at 00:05 UTC. Auth via `Bearer ${CRON_SECRET}`.
 *
 * Picks up three buckets of subscriptions and tries to charge the card on
 * file for each:
 *
 *   1. trial-end      status='trialing' AND trial_ends_at <= now
 *   2. period-renewal status='active'   AND current_period_end <= now
 *   3. past-due-retry status='past_due' AND last_charge_attempt_at <= now-1d
 *                                       AND failed_charge_count < 7
 *
 * Bill math: tier.monthly_price_cents × active_rep_count. "Active rep" is
 * defined here as any user_profiles row in the org. The marketing copy
 * says "knocks at least one door / logs any activity", which we can
 * tighten later with a 30-day activity check.
 *
 * Idempotency: `billing_charges` has a unique index on (org_id, period_start)
 * so a re-run on the same day won't double-charge.
 *
 * On success → status='active', current_period_end = now + 30d.
 * On failure → status='past_due', failed_charge_count++, retry tomorrow.
 * After 7 consecutive failures → status='suspended'.
 */

const PERIOD_DAYS = 30;
const PERIOD_MS = PERIOD_DAYS * 24 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 7;

type SubRow = {
  id: string;
  org_id: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "suspended";
  tier_key: string;
  trial_started_at: string;
  trial_ends_at: string;
  current_period_end: string | null;
  square_customer_id: string | null;
  square_card_id: string | null;
  last_charge_attempt_at: string | null;
  failed_charge_count: number | null;
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const oneDayAgo = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();

  // Pull every candidate in one round-trip then filter in JS — the table
  // stays tiny (one row per org) so this is cheaper than three filtered
  // queries with OR.
  const { data: subs, error } = await admin
    .from("org_subscriptions")
    .select("*")
    .in("status", ["trialing", "active", "past_due"]);

  if (error) {
    console.error("[billing-renewal] fetch error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{
    org_id: string;
    action: "charged" | "skipped" | "failed" | "suspended";
    amount_cents?: number;
    rep_count?: number;
    reason?: string;
    payment_id?: string;
  }> = [];

  for (const subRaw of (subs ?? []) as SubRow[]) {
    const sub = subRaw;

    // Decide whether this subscription is due for a charge.
    let dueReason: "trial_end" | "renewal" | "past_due_retry" | null = null;
    let periodStart: string;

    if (sub.status === "trialing" && new Date(sub.trial_ends_at).getTime() <= nowMs) {
      dueReason = "trial_end";
      periodStart = sub.trial_ends_at; // first paid period starts when trial ends
    } else if (
      sub.status === "active" &&
      sub.current_period_end &&
      new Date(sub.current_period_end).getTime() <= nowMs
    ) {
      dueReason = "renewal";
      periodStart = sub.current_period_end;
    } else if (
      sub.status === "past_due" &&
      (!sub.last_charge_attempt_at || sub.last_charge_attempt_at <= oneDayAgo) &&
      (sub.failed_charge_count ?? 0) < MAX_FAILED_ATTEMPTS
    ) {
      dueReason = "past_due_retry";
      periodStart =
        sub.current_period_end ?? sub.trial_ends_at ?? nowIso;
    } else {
      continue;
    }

    const tier = getTier(sub.tier_key);
    if (!tier || tier.monthly_price_cents === null) {
      results.push({ org_id: sub.org_id, action: "skipped", reason: `unknown or contact-sales tier: ${sub.tier_key}` });
      continue;
    }

    if (!sub.square_customer_id || !sub.square_card_id) {
      results.push({ org_id: sub.org_id, action: "skipped", reason: "no card on file" });
      continue;
    }

    // Idempotency: skip if a billing_charges row already exists for this
    // (org_id, period_start). The unique index will also catch a race.
    const { data: existing } = await admin
      .from("billing_charges")
      .select("id, status")
      .eq("org_id", sub.org_id)
      .eq("period_start", periodStart)
      .maybeSingle();
    if (existing && existing.status === "succeeded") {
      results.push({ org_id: sub.org_id, action: "skipped", reason: "already charged for this period" });
      continue;
    }

    // Count billable reps (every user_profiles row in the org for v1).
    const { count: repCount } = await admin
      .from("user_profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("org_id", sub.org_id);

    const reps = repCount ?? 0;
    if (reps === 0) {
      results.push({ org_id: sub.org_id, action: "skipped", reason: "no reps to bill" });
      continue;
    }

    const amount = tier.monthly_price_cents * reps;
    const periodEnd = new Date(new Date(periodStart).getTime() + PERIOD_MS).toISOString();

    // Mark attempt before calling Square so a hang doesn't get retried twice today.
    await admin
      .from("org_subscriptions")
      .update({ last_charge_attempt_at: nowIso })
      .eq("id", sub.id);

    try {
      const payment = await chargeCardOnFile({
        customerId: sub.square_customer_id,
        cardId: sub.square_card_id,
        amountCents: amount,
        note: `Rouxte ${tier.name} · ${reps} rep${reps === 1 ? "" : "s"} · ${periodStart.slice(0, 10)} → ${periodEnd.slice(0, 10)}`,
      });

      await admin.from("billing_charges").upsert(
        {
          org_id: sub.org_id,
          amount_cents: amount,
          currency: "USD",
          rep_count: reps,
          tier_key: tier.key,
          period_start: periodStart,
          period_end: periodEnd,
          square_payment_id: payment.paymentId,
          status: "succeeded",
        },
        { onConflict: "org_id,period_start" },
      );

      await admin
        .from("org_subscriptions")
        .update({
          status: "active",
          current_period_end: periodEnd,
          failed_charge_count: 0,
        })
        .eq("id", sub.id);

      results.push({
        org_id: sub.org_id,
        action: "charged",
        amount_cents: amount,
        rep_count: reps,
        reason: dueReason,
        payment_id: payment.paymentId,
      });
    } catch (e) {
      const reason = e instanceof Error ? e.message : "charge failed";
      const nextFailedCount = (sub.failed_charge_count ?? 0) + 1;
      const suspend = nextFailedCount >= MAX_FAILED_ATTEMPTS;

      await admin.from("billing_charges").upsert(
        {
          org_id: sub.org_id,
          amount_cents: amount,
          currency: "USD",
          rep_count: reps,
          tier_key: tier.key,
          period_start: periodStart,
          period_end: periodEnd,
          status: "failed",
          failure_reason: reason,
        },
        { onConflict: "org_id,period_start" },
      );

      await admin
        .from("org_subscriptions")
        .update({
          status: suspend ? "suspended" : "past_due",
          failed_charge_count: nextFailedCount,
        })
        .eq("id", sub.id);

      results.push({
        org_id: sub.org_id,
        action: suspend ? "suspended" : "failed",
        amount_cents: amount,
        rep_count: reps,
        reason,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    ran_at: nowIso,
    processed: results.length,
    results,
  });
}
