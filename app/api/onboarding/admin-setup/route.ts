import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, FROM } from "@/lib/email/resend";
import { inviteEmail } from "@/lib/email/templates";

/**
 * POST /api/onboarding/admin-setup
 *
 * Persists the admin onboarding wizard. Two shapes:
 *
 *   Solo:
 *     { shape: "solo", solo_comp_per_sale_cents: number }
 *
 *   Team:
 *     { shape: "team",
 *       org_name, niche, primary_carriers, brand_color,
 *       members: Array<{ email, full_name, role, commission_pct? }>,
 *       comp_plans: Array<{ carrier, product, rep_payout_cents,
 *                           manager_override_cents, lead_override_cents }>,
 *       territory_zips: string[] }
 *
 * orgs.onboarding_state captures everything in JSONB for now. Comp plans
 * land in their own `comp_plans` table so we can join them at quote time.
 */

type Role = "admin" | "sales_manager" | "team_lead" | "sales_rep";
const ROLES: Role[] = ["admin", "sales_manager", "team_lead", "sales_rep"];

interface Member {
  email: string;
  full_name?: string;
  role: Role;
  commission_pct?: number;
}
interface CompPlanRow {
  carrier: string;
  product: string;
  rep_payout_cents: number;
  manager_override_cents: number;
  lead_override_cents: number;
}

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

  const shape = body.shape === "solo" ? "solo" : "team";

  // ─── Solo branch ────────────────────────────────────────────────────────
  if (shape === "solo") {
    const compCents = typeof body.solo_comp_per_sale_cents === "number"
      ? Math.max(0, Math.round(body.solo_comp_per_sale_cents))
      : 0;

    const { error } = await admin
      .from("orgs")
      .update({
        onboarding_state: { shape: "solo", solo_comp_per_sale_cents: compCents },
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", profile.org_id);

    if (error) {
      console.error("[admin-setup/solo] DB error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, shape: "solo" });
  }

  // ─── Team branch ────────────────────────────────────────────────────────
  const orgName     = typeof body.org_name === "string" ? body.org_name.trim() : "";
  const niche       = typeof body.niche === "string" ? body.niche : null;
  const carriers    = Array.isArray(body.primary_carriers) ? body.primary_carriers : [];
  const brandColor  = typeof body.brand_color === "string" ? body.brand_color : null;
  const territoryZips = Array.isArray(body.territory_zips) ? body.territory_zips : [];

  const membersRaw = Array.isArray(body.members) ? body.members : [];
  const members: Member[] = membersRaw
    .map((m): Member | null => {
      const row = m as Record<string, unknown>;
      const email = typeof row.email === "string" ? row.email.trim().toLowerCase() : "";
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
      const roleRaw = typeof row.role === "string" ? row.role : "sales_rep";
      const role = ROLES.includes(roleRaw as Role) ? (roleRaw as Role) : "sales_rep";
      return {
        email,
        full_name: typeof row.full_name === "string" ? row.full_name.trim() : undefined,
        role,
        commission_pct: typeof row.commission_pct === "number" ? row.commission_pct : undefined,
      };
    })
    .filter((m): m is Member => m !== null);

  const compPlansRaw = Array.isArray(body.comp_plans) ? body.comp_plans : [];
  const compPlans: CompPlanRow[] = compPlansRaw
    .map((p): CompPlanRow | null => {
      const row = p as Record<string, unknown>;
      const carrier = typeof row.carrier === "string" ? row.carrier.trim() : "";
      const product = typeof row.product === "string" ? row.product.trim() : "";
      if (!carrier || !product) return null;
      return {
        carrier,
        product,
        rep_payout_cents: typeof row.rep_payout_cents === "number" ? Math.max(0, Math.round(row.rep_payout_cents)) : 0,
        manager_override_cents: typeof row.manager_override_cents === "number" ? Math.max(0, Math.round(row.manager_override_cents)) : 0,
        lead_override_cents: typeof row.lead_override_cents === "number" ? Math.max(0, Math.round(row.lead_override_cents)) : 0,
      };
    })
    .filter((p): p is CompPlanRow => p !== null && p.rep_payout_cents > 0);

  // Persist org state
  const onboardingState = {
    shape: "team",
    niche,
    primary_carriers: carriers,
    brand_color: brandColor,
    territory_zips: territoryZips,
    team_size: members.length,
  };

  const orgUpdate: Record<string, unknown> = {
    onboarding_state: onboardingState,
    onboarding_completed_at: new Date().toISOString(),
  };
  if (orgName) orgUpdate.name = orgName;

  const { error: orgErr } = await admin
    .from("orgs").update(orgUpdate).eq("id", profile.org_id);
  if (orgErr) {
    console.error("[admin-setup/team] org update error:", orgErr);
    return NextResponse.json({ error: orgErr.message }, { status: 500 });
  }

  // Persist comp plans — replace the org's plans wholesale on save
  if (compPlans.length > 0) {
    await admin.from("comp_plans").delete().eq("org_id", profile.org_id);
    const { error: cpErr } = await admin.from("comp_plans").insert(
      compPlans.map((p) => ({ ...p, org_id: profile.org_id })),
    );
    if (cpErr) {
      console.error("[admin-setup/team] comp_plans insert error:", cpErr);
      // non-fatal — log and continue so we don't block invites
    }
  }

  // Dispatch invites — one per row, each with its own role
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://rouxte.com";
  const { data: org } = await admin.from("orgs").select("name").eq("id", profile.org_id).single();
  const orgName_ = org?.name ?? orgName ?? "your team";

  const invitesAttempted: Array<{ email: string; role: Role; sent: boolean; reason?: string }> = [];

  for (const m of members) {
    const token = randomBytes(16).toString("hex");
    const { error: inviteErr } = await admin.from("invites").insert({
      org_id:     profile.org_id,
      created_by: user.id,
      email:      m.email,
      role:       m.role,
      team_id:    null,
      token,
    });
    if (inviteErr) {
      invitesAttempted.push({ email: m.email, role: m.role, sent: false, reason: inviteErr.message });
      continue;
    }

    const inviteUrl = `${appUrl}/invite/${token}`;
    const { subject, html } = inviteEmail({
      orgName:     orgName_,
      role:        m.role,
      inviteUrl,
      inviterName: profile.full_name ?? "Your Manager",
    });
    const sent = await sendEmail({ from: FROM, to: m.email, subject, html });
    invitesAttempted.push({ email: m.email, role: m.role, sent });
  }

  return NextResponse.json({
    ok: true,
    shape: "team",
    invites: invitesAttempted,
    invites_sent: invitesAttempted.filter((i) => i.sent).length,
    comp_plans_saved: compPlans.length,
  });
}
