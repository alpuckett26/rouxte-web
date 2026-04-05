import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomBytes } from "crypto";

async function getProfile(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_profiles")
    .select("org_id, role, team_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

// GET /api/invites — list pending (non-accepted) invites for the org
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invites")
    .select("*, team:team_id(name)")
    .eq("org_id", profile.org_id)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/invites — create invite { email, role, team_id? }
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  // Only team_lead and above can invite
  if (profile.role === "sales_rep") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();
  const email: string = body.email?.trim().toLowerCase();
  const role: string = body.role ?? "sales_rep";
  // Team leads can only invite reps to their own team
  const teamId: string | null =
    profile.role === "team_lead" ? (profile.team_id ?? null) : (body.team_id ?? null);

  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const token = randomBytes(16).toString("hex");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invites")
    .insert({
      org_id: profile.org_id,
      created_by: user.id,
      email,
      role,
      team_id: teamId,
      token,
    })
    .select("*, team:team_id(name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
