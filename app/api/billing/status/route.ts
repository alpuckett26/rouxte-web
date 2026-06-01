import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/billing/status
 * Returns the current authenticated user's org subscription row,
 * or { data: null } if the org has never started a trial.
 *
 * Also computes derived fields the UI cares about (days_left,
 * is_in_trial, needs_payment).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.org_id) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Surfaced at the top level (not just inside `data`) so callers can make
  // role-aware decisions — e.g. the mobile BillingGate must know whether the
  // viewer is an admin even when there's NO subscription row at all, since
  // only admins can act on billing and reps should never see a purchase CTA.
  const viewer_is_admin = profile.role === "admin";

  const { data: sub } = await admin
    .from("org_subscriptions")
    .select("*")
    .eq("org_id", profile.org_id)
    .maybeSingle();

  if (!sub) return NextResponse.json({ data: null, viewer_is_admin });

  const now = Date.now();
  const trialEnds = new Date(sub.trial_ends_at).getTime();
  const days_left = Math.max(0, Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24)));
  const is_in_trial = sub.status === "trialing" && trialEnds > now;
  const has_active_access = ["trialing", "active", "past_due"].includes(sub.status);
  const needs_payment = sub.status === "trialing" && !sub.square_card_id;

  return NextResponse.json({
    // Top-level mirror so callers don't have to reach into `data` (and so it's
    // consistent with the no-subscription response above).
    viewer_is_admin,
    data: {
      ...sub,
      days_left,
      is_in_trial,
      has_active_access,
      needs_payment,
      // surfaces whether *this* viewer can modify billing
      viewer_is_admin,
    },
  });
}
