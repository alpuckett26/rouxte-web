import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles")
    .select("org_id").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: org } = await admin.from("orgs")
    .select("id, name, provider_name, service_type, provider_color, team_lead_override_pct, manager_override_pct")
    .eq("id", profile.org_id).maybeSingle();

  return NextResponse.json({ data: org });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles")
    .select("org_id, role").eq("user_id", user.id).maybeSingle();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const allowed = [
    "name", "provider_name", "service_type", "provider_color",
    "team_lead_override_pct", "manager_override_pct",
  ];
  const update = Object.fromEntries(
    Object.entries(body)
      .filter(([k]) => allowed.includes(k))
      .map(([k, v]) => {
        // Sanitize the two numeric overrides
        if (k === "team_lead_override_pct" || k === "manager_override_pct") {
          const n = Number(v);
          if (Number.isFinite(n) && n >= 0 && n <= 100) return [k, n];
          return [k, null];
        }
        return [k, v];
      })
      .filter(([, v]) => v !== null)
  );

  const { data, error } = await admin.from("orgs")
    .update(update).eq("id", profile.org_id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
