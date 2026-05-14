import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/billing/cancel
 * Sets the subscription status to 'canceled'. Org keeps access
 * until trial_ends_at (or current_period_end if billing has started).
 * Re-enrolling requires going back through PricingModal.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("user_profiles").select("org_id, role")
    .eq("user_id", user.id).maybeSingle();
  if (!profile?.org_id) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Only admins can cancel billing" }, { status: 403 });
  }

  const { error } = await admin
    .from("org_subscriptions")
    .update({ status: "canceled" })
    .eq("org_id", profile.org_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
