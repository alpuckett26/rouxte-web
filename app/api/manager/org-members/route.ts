import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/manager/org-members
// Returns all user_id + full_name pairs in the org — used by migration wizard
// to match imported rep names to Rouxte accounts.
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

  if (!profile || !["admin", "sales_manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: members } = await admin
    .from("user_profiles")
    .select("user_id, full_name, role")
    .eq("org_id", profile.org_id)
    .is("deleted_at", null)
    .order("full_name");

  return NextResponse.json({ data: members ?? [] });
}
