import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, full_name, org_id, team_id, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  // Fetch org name
  let org_name: string | null = null;
  if (profile?.org_id) {
    const admin = createAdminClient();
    const { data: org } = await admin
      .from("orgs")
      .select("name")
      .eq("id", profile.org_id)
      .maybeSingle();
    org_name = org?.name ?? null;
  }

  // Return flat object — useProfile and other consumers expect the profile at the root level
  return NextResponse.json({
    user_id:    user.id,
    email:      user.email,
    role:       profile?.role      ?? "sales_rep",
    full_name:  profile?.full_name ?? null,
    org_id:     profile?.org_id    ?? null,
    team_id:    profile?.team_id   ?? null,
    avatar_url: profile?.avatar_url ?? null,
    org_name,
  });
}
