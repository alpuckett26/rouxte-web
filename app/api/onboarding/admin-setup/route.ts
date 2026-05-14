import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, FROM } from "@/lib/email/resend";
import { inviteEmail } from "@/lib/email/templates";

/**
 * POST /api/onboarding/admin-setup
 *
 * Persists the admin onboarding wizard data onto the org row.
 * Stored in orgs.onboarding_state (jsonb) so we can ship without
 * a full schema for every field. A follow-up migration can promote
 * frequently-queried fields (niche, brand_color) to first-class
 * columns.
 *
 * Body:
 *   org_name?         updates orgs.name if provided
 *   niche             'fiber' | 'wireless' | 'both'
 *   primary_carriers  string[]
 *   brand_color       hex string
 *   invite_emails     string[]  (queued — not yet emailed)
 *   invite_role       'sales_rep' | 'team_lead' | 'sales_manager'
 *   territory_zips    string[]
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id, role, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.org_id) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Only org admins can run onboarding setup" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const orgName        = typeof body.org_name === "string" ? body.org_name.trim() : "";
  const niche          = typeof body.niche === "string" ? body.niche : null;
  const carriers       = Array.isArray(body.primary_carriers) ? body.primary_carriers : [];
  const brandColor     = typeof body.brand_color === "string" ? body.brand_color : null;
  const inviteEmails   = Array.isArray(body.invite_emails) ? body.invite_emails : [];
  const inviteRole     = typeof body.invite_role === "string" ? body.invite_role : "sales_rep";
  const territoryZips  = Array.isArray(body.territory_zips) ? body.territory_zips : [];

  const onboardingState = {
    niche,
    primary_carriers: carriers,
    brand_color: brandColor,
    invite_role: inviteRole,
    territory_zips: territoryZips,
  };

  const update: Record<string, unknown> = {
    onboarding_state: onboardingState,
    onboarding_completed_at: new Date().toISOString(),
  };
  if (orgName) update.name = orgName;

  const { error } = await admin
    .from("orgs")
    .update(update)
    .eq("id", profile.org_id);

  if (error) {
    console.error("[/api/onboarding/admin-setup] DB error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ─── Dispatch invites ──────────────────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://rouxte.com";
  const { data: org } = await admin
    .from("orgs").select("name").eq("id", profile.org_id).single();
  const orgName_ = org?.name ?? orgName ?? "your team";

  const invitesAttempted: Array<{ email: string; sent: boolean; reason?: string }> = [];

  for (const raw of inviteEmails) {
    const email = String(raw).trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      invitesAttempted.push({ email, sent: false, reason: "invalid_email" });
      continue;
    }

    const token = randomBytes(16).toString("hex");
    const { error: inviteErr } = await admin.from("invites").insert({
      org_id:     profile.org_id,
      created_by: user.id,
      email,
      role:       inviteRole,
      team_id:    null,
      token,
    });
    if (inviteErr) {
      invitesAttempted.push({ email, sent: false, reason: inviteErr.message });
      continue;
    }

    const inviteUrl = `${appUrl}/invite/${token}`;
    const { subject, html } = inviteEmail({
      orgName:     orgName_,
      role:        inviteRole,
      inviteUrl,
      inviterName: profile.full_name ?? "Your Manager",
    });
    const sent = await sendEmail({ from: FROM, to: email, subject, html });
    invitesAttempted.push({ email, sent });
  }

  return NextResponse.json({
    ok: true,
    invites: invitesAttempted,
    invites_sent: invitesAttempted.filter((i) => i.sent).length,
  });
}
