import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { LeadStatus } from "@/lib/types";

// Statuses that require explicit `force: true` to pull
const PROTECTED_STATUSES: LeadStatus[] = ["appointment_set", "sold", "installed"];

/**
 * POST /api/manager/leads/pull
 * Pull one or more leads from a rep back to the unassigned org pool.
 *
 * Body:
 *   rep_id   string       — the rep to pull from
 *   lead_ids string[]     — specific leads to pull (or omit to pull all eligible)
 *   force    boolean      — required to pull protected-stage leads (appointment_set/sold/installed)
 *   reason   string       — optional reason logged to activity
 */
export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: "Forbidden — managers only" }, { status: 403 });
  }

  const body = await request.json();
  const repId: string = body.rep_id;
  const leadIds: string[] | undefined = body.lead_ids;
  const force: boolean = body.force === true;
  const reason: string = body.reason ?? "Manager pull";

  if (!repId) return NextResponse.json({ error: "rep_id is required" }, { status: 400 });

  // Verify rep is in the same org
  const { data: repProfile } = await admin
    .from("user_profiles")
    .select("full_name")
    .eq("user_id", repId)
    .eq("org_id", profile.org_id)
    .maybeSingle();

  if (!repProfile) {
    return NextResponse.json({ error: "Rep not found in org" }, { status: 404 });
  }

  // Fetch candidate leads
  let query = admin
    .from("leads")
    .select("id, status, address")
    .eq("org_id", profile.org_id)
    .eq("assigned_to", repId);

  if (leadIds?.length) {
    query = query.in("id", leadIds);
  }

  const { data: leads } = await query;
  if (!leads?.length) {
    return NextResponse.json({ error: "No leads found for this rep" }, { status: 404 });
  }

  // Separate protected vs free-pull leads
  const protectedLeads = leads.filter((l) => PROTECTED_STATUSES.includes(l.status as LeadStatus));
  const freeLeads      = leads.filter((l) => !PROTECTED_STATUSES.includes(l.status as LeadStatus));

  // If there are protected leads and force is not set, return a warning
  if (protectedLeads.length > 0 && !force) {
    return NextResponse.json({
      warning: "protected_leads",
      message: `${protectedLeads.length} lead(s) are past appointment stage (${protectedLeads.map(l => l.status).join(", ")}). Pass force: true to pull these too, or pull only the free leads.`,
      protected_count: protectedLeads.length,
      free_count:      freeLeads.length,
      protected_leads: protectedLeads.map((l) => ({ id: l.id, status: l.status, address: l.address })),
    }, { status: 409 });
  }

  const toPull = force ? leads : freeLeads;
  if (!toPull.length) {
    return NextResponse.json({ error: "No eligible leads to pull" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const cooldownUntil = new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString(); // ~6 months

  const pullIds = toPull.map((l) => l.id);

  const { error: updateErr } = await admin
    .from("leads")
    .update({
      assigned_to:   null,
      assigned_at:   null,
      pulled_at:     now,
      pulled_by:     user.id,
      cooldown_until: cooldownUntil,
      pull_reason:   reason,
      updated_at:    now,
    })
    .in("id", pullIds);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Activity log
  await admin.from("sales_activity_log").insert(
    pullIds.map((id) => ({
      org_id:     profile.org_id,
      lead_id:    id,
      actor_id:   user.id,
      event_type: "lead_pulled",
      summary:    `Pulled from ${repProfile.full_name} — ${reason}. Cooldown until ${new Date(cooldownUntil).toLocaleDateString()}.`,
      is_incident: false,
      metadata:   { rep_id: repId, reason, force, cooldown_until: cooldownUntil },
    }))
  );

  return NextResponse.json({
    ok:      true,
    pulled:  pullIds.length,
    skipped: force ? 0 : protectedLeads.length,
    cooldown_until: cooldownUntil,
  });
}
