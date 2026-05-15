import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomBytes } from "crypto";
import { sendEmail, FROM } from "@/lib/email/resend";
import { inviteEmail } from "@/lib/email/templates";

async function getProfile(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_profiles")
    .select("org_id, role, team_id, full_name")
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
  const fullName: string | null = typeof body.full_name === "string" ? body.full_name.trim() : null;
  const phone: string | null = typeof body.phone === "string" ? body.phone.trim() || null : null;
  const personalNote: string | null = typeof body.personal_note === "string" ? body.personal_note.trim() || null : null;
  const territoryZips: string[] = Array.isArray(body.territory_zips)
    ? body.territory_zips.map(String).map((z: string) => z.trim()).filter(Boolean)
    : typeof body.territory_zips === "string"
    ? body.territory_zips.split(/[\s,;]+/).map((s: string) => s.trim()).filter(Boolean)
    : [];

  // Team leads can only invite reps to their own team
  const teamId: string | null =
    profile.role === "team_lead" ? (profile.team_id ?? null) : (body.team_id ?? null);

  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  if (!fullName) return NextResponse.json({ error: "Full name is required" }, { status: 400 });

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
      full_name: fullName,
      phone,
      personal_note: personalNote,
      territory_zips: territoryZips.length > 0 ? territoryZips : null,
    })
    .select("*, team:team_id(name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send invite email (best-effort — don't fail the request if email fails)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://rouxte.com";
  const inviteUrl = `${appUrl}/invite/${token}`;

  const { data: org } = await admin.from("orgs").select("name").eq("id", profile.org_id).single();
  const teamName = (data as { team?: { name?: string } | null }).team?.name ?? undefined;
  const { subject, html } = inviteEmail({
    orgName: org?.name ?? "your team",
    role,
    inviteUrl,
    inviterName: (profile as { full_name?: string }).full_name ?? "Your Manager",
    fullName: fullName ?? undefined,
    personalNote: personalNote ?? undefined,
    teamName,
  });

  const emailSent = await sendEmail({ from: FROM, to: email, subject, html });

  return NextResponse.json({ data, invite_url: inviteUrl, email_sent: emailSent }, { status: 201 });
}
