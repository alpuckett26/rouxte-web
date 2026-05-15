import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, FROM } from "@/lib/email/resend";
import { inviteAcceptedEmail } from "@/lib/email/templates";

interface Params { params: Promise<{ token: string }> }

// GET /api/invites/[token] — validate token, return invite + org info (public)
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: invite, error } = await admin
    .from("invites")
    .select("id, email, role, team_id, expires_at, accepted_at, org:org_id(name), team:team_id(name)")
    .eq("token", token)
    .maybeSingle();

  if (error || !invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (invite.accepted_at) {
    return NextResponse.json({ error: "Invite already accepted" }, { status: 410 });
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }

  return NextResponse.json({ data: invite });
}

// POST /api/invites/[token]/accept — authenticated user accepts the invite
export async function POST(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Validate invite
  const { data: invite } = await admin
    .from("invites")
    .select("id, org_id, role, team_id, expires_at, accepted_at, full_name, phone, territory_zips")
    .eq("token", token)
    .maybeSingle();

  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.accepted_at) return NextResponse.json({ error: "Already accepted" }, { status: 410 });
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }

  // Get any existing profile for this user (any org)
  const { data: anyProfile } = await admin
    .from("user_profiles")
    .select("id, full_name, org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Upsert profile into the invited org — overwrite role/team if they self-onboarded elsewhere.
  // Prefer the name the manager typed on the invite over what the user picked themselves.
  const inviteFullName = (invite as { full_name?: string | null }).full_name;
  const invitePhone    = (invite as { phone?: string | null }).phone;
  const inviteZips     = (invite as { territory_zips?: string[] | null }).territory_zips;

  const profilePayload: Record<string, unknown> = {
    user_id: user.id,
    org_id: invite.org_id,
    role: invite.role,
    team_id: invite.team_id ?? null,
    full_name: inviteFullName ?? anyProfile?.full_name ?? user.email?.split("@")[0] ?? "",
    onboarding_step: "complete",
    onboarding_complete: true,
    updated_at: new Date().toISOString(),
  };
  if (invitePhone) profilePayload.phone = invitePhone;
  if (inviteZips && inviteZips.length > 0) profilePayload.territory = inviteZips.join(", ");

  const { error: profileError } = await admin
    .from("user_profiles")
    .upsert(profilePayload, { onConflict: "user_id,org_id" });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // If user had a personal/self-onboarded org, clean it up
  if (anyProfile?.org_id && anyProfile.org_id !== invite.org_id) {
    await admin.from("user_profiles").delete()
      .eq("user_id", user.id)
      .eq("org_id", anyProfile.org_id);
  }

  // Add to team_members table if team is specified
  if (invite.team_id) {
    await admin.from("team_members").upsert(
      { team_id: invite.team_id, user_id: user.id, role: invite.role },
      { onConflict: "team_id,user_id" }
    );
  }

  // Mark invite accepted
  await admin
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  // Notify the manager/inviter that the rep joined
  const { data: inviteRow } = await admin
    .from("invites")
    .select("invited_by, org:org_id(name), role")
    .eq("id", invite.id)
    .maybeSingle();

  if (inviteRow?.invited_by) {
    const { data: { user: managerUser } } = await admin.auth.admin.getUserById(inviteRow.invited_by);
    if (managerUser?.email) {
      const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rouxte.com";
      const orgName = (inviteRow.org as { name?: string } | null)?.name ?? "your org";
      const tpl = inviteAcceptedEmail({
        repName:  anyProfile?.full_name ?? user.email?.split("@")[0] ?? "A new rep",
        repEmail: user.email ?? "",
        orgName,
        role:     invite.role,
        dashUrl:  `${origin}/manager`,
      });
      await sendEmail({ from: FROM, to: managerUser.email, ...tpl });
    }
  }

  return NextResponse.json({ ok: true });
}
