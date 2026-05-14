/**
 * Renewal engine — shared between the daily cron and the admin
 * "Force renewal now" button. Charges the saved card on file for one
 * subscription, records the result, advances the period or moves the
 * subscription to past_due/suspended.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { chargeCardOnFile } from "@/lib/billing/square-subscriptions";
import { getTier } from "@/lib/billing/tiers";

export const PERIOD_DAYS = 30;
const PERIOD_MS = PERIOD_DAYS * 24 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 7;

export type SubRow = {
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

export type DueReason = "trial_end" | "renewal" | "past_due_retry" | "forced";

export type RenewalResult = {
  org_id: string;
  action: "charged" | "skipped" | "failed" | "suspended";
  amount_cents?: number;
  rep_count?: number;
  reason?: string;
  payment_id?: string;
};

interface ProcessOptions {
  /** If true, ignore due-date check and charge now. */
  force?: boolean;
}

/**
 * Decide whether the given subscription is due for a charge today.
 * Returns the period_start to use, or null if not due.
 */
function computeDueness(
  sub: SubRow,
  nowMs: number,
  oneDayAgoIso: string,
  force: boolean,
): { reason: DueReason; period_start: string } | null {
  if (force) {
    // Pick the most sensible period_start when forcing
    const periodStart =
      sub.status === "trialing" ? sub.trial_ends_at :
      sub.current_period_end ?? sub.trial_ends_at ?? new Date(nowMs).toISOString();
    return { reason: "forced", period_start: periodStart };
  }

  if (sub.status === "trialing" && new Date(sub.trial_ends_at).getTime() <= nowMs) {
    return { reason: "trial_end", period_start: sub.trial_ends_at };
  }

  if (
    sub.status === "active" &&
    sub.current_period_end &&
    new Date(sub.current_period_end).getTime() <= nowMs
  ) {
    return { reason: "renewal", period_start: sub.current_period_end };
  }

  if (
    sub.status === "past_due" &&
    (!sub.last_charge_attempt_at || sub.last_charge_attempt_at <= oneDayAgoIso) &&
    (sub.failed_charge_count ?? 0) < MAX_FAILED_ATTEMPTS
  ) {
    return {
      reason: "past_due_retry",
      period_start: sub.current_period_end ?? sub.trial_ends_at ?? new Date(nowMs).toISOString(),
    };
  }

  return null;
}

/**
 * Process a single subscription. Used by the cron in a loop and by the
 * admin "Force renewal" endpoint for one-shot use.
 */
export async function processSubscription(
  admin: SupabaseClient,
  sub: SubRow,
  opts: ProcessOptions = {},
): Promise<RenewalResult> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const oneDayAgoIso = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();

  const due = computeDueness(sub, nowMs, oneDayAgoIso, !!opts.force);
  if (!due) {
    return { org_id: sub.org_id, action: "skipped", reason: "not due" };
  }

  const tier = getTier(sub.tier_key);
  if (!tier || tier.monthly_price_cents === null) {
    return { org_id: sub.org_id, action: "skipped", reason: `unknown or contact-sales tier: ${sub.tier_key}` };
  }

  if (!sub.square_customer_id || !sub.square_card_id) {
    return { org_id: sub.org_id, action: "skipped", reason: "no card on file" };
  }

  // Idempotency check
  const { data: existing } = await admin
    .from("billing_charges")
    .select("id, status")
    .eq("org_id", sub.org_id)
    .eq("period_start", due.period_start)
    .maybeSingle();
  if (existing && existing.status === "succeeded") {
    return { org_id: sub.org_id, action: "skipped", reason: "already charged for this period" };
  }

  // Count billable reps
  const { count: repCount } = await admin
    .from("user_profiles")
    .select("user_id", { count: "exact", head: true })
    .eq("org_id", sub.org_id);

  const reps = repCount ?? 0;
  if (reps === 0) {
    return { org_id: sub.org_id, action: "skipped", reason: "no reps to bill" };
  }

  const amount = tier.monthly_price_cents * reps;
  const periodEnd = new Date(new Date(due.period_start).getTime() + PERIOD_MS).toISOString();

  // Mark attempt before calling Square
  await admin
    .from("org_subscriptions")
    .update({ last_charge_attempt_at: nowIso })
    .eq("id", sub.id);

  try {
    const payment = await chargeCardOnFile({
      customerId: sub.square_customer_id,
      cardId: sub.square_card_id,
      amountCents: amount,
      note: `Rouxte ${tier.name} · ${reps} rep${reps === 1 ? "" : "s"} · ${due.period_start.slice(0, 10)} → ${periodEnd.slice(0, 10)}`,
    });

    await admin.from("billing_charges").upsert(
      {
        org_id: sub.org_id,
        amount_cents: amount,
        currency: "USD",
        rep_count: reps,
        tier_key: tier.key,
        period_start: due.period_start,
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

    return {
      org_id: sub.org_id,
      action: "charged",
      amount_cents: amount,
      rep_count: reps,
      reason: due.reason,
      payment_id: payment.paymentId,
    };
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
        period_start: due.period_start,
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

    return {
      org_id: sub.org_id,
      action: suspend ? "suspended" : "failed",
      amount_cents: amount,
      rep_count: reps,
      reason,
    };
  }
}
