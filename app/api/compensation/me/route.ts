import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/compensation/me — current user's tier, standing, and commission pct
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("sales_tier_id, standing")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  let tier = null;
  if (profile.sales_tier_id) {
    const { data } = await admin
      .from("sales_tiers")
      .select("id, name, commission_pct")
      .eq("id", profile.sales_tier_id)
      .maybeSingle();
    tier = data;
  }

  return NextResponse.json({ tier, standing: profile.standing ?? "active" });
}
