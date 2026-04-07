import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "sales_manager", "team_lead"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch locations updated within the last 5 minutes (active reps only)
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: locations } = await admin
    .from("rep_locations")
    .select("user_id, lat, lng, updated_at")
    .eq("org_id", profile.org_id)
    .gte("updated_at", cutoff);

  if (!locations?.length) return NextResponse.json({ data: [] });

  // Enrich with names
  const userIds = locations.map((l) => l.user_id);
  const { data: profiles } = await admin.from("user_profiles")
    .select("user_id, full_name, role")
    .in("user_id", userIds);

  const nameMap: Record<string, { full_name: string; role: string }> = {};
  for (const p of profiles ?? []) nameMap[p.user_id] = { full_name: p.full_name, role: p.role };

  const enriched = locations.map((l) => ({
    ...l,
    full_name: nameMap[l.user_id]?.full_name ?? "Unknown",
    role: nameMap[l.user_id]?.role ?? "sales_rep",
    initials: (nameMap[l.user_id]?.full_name ?? "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase(),
  }));

  return NextResponse.json({ data: enriched });
}
