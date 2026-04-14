import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/cron/lead-expiry
 * Vercel cron job — runs daily at 06:00 UTC.
 *
 * Auto-pull logic (per rep per org):
 *   Week 1  (≥7 days old):  if worked_pct < 30% → pull completely untouched leads (status = 'new')
 *   Week 2  (≥14 days old): if worked_pct < 60% → pull untouched + barely-touched (status in 'new','attempted')
 *   Week 3+ (≥21 days old): pull ALL unworked leads (status in 'new','attempted','contacted')
 *
 * "Worked" = status has moved past 'new'.
 * Pulled leads get a 6-month cooldown_until.
 */
export async function GET(request: NextRequest) {
  // Verify this is called by Vercel cron or an authorized internal caller
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // ── 1. Fetch all rep-level lead summaries ──────────────────────────────────
  // Group by (org_id, assigned_to), only leads with assigned_at set and no cooldown already
  const { data: repGroups, error: groupErr } = await admin
    .from("leads")
    .select("id, org_id, assigned_to, assigned_at, status")
    .not("assigned_to", "is", null)
    .not("assigned_at", "is", null)
    .is("cooldown_until", null);

  if (groupErr) {
    console.error("[lead-expiry cron] fetch error:", groupErr.message);
    return NextResponse.json({ error: groupErr.message }, { status: 500 });
  }

  const leads = repGroups ?? [];

  // Group by (org_id + assigned_to)
  type RepKey = string;
  const grouped: Record<RepKey, typeof leads> = {};
  for (const lead of leads) {
    const key = `${lead.org_id}::${lead.assigned_to}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(lead);
  }

  const now     = Date.now();
  const cooldownUntil = new Date(now + 6 * 30 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso  = new Date(now).toISOString();

  let totalPulled = 0;
  const pullLog: Array<{ org_id: string; rep_id: string; pulled: number; reason: string }> = [];

  for (const [key, repLeads] of Object.entries(grouped)) {
    const [orgId, repId] = key.split("::");

    // Find oldest assigned_at to compute age
    const oldestAssignedAt = repLeads.reduce((oldest, l) => {
      return !oldest || l.assigned_at! < oldest ? l.assigned_at! : oldest;
    }, null as string | null);

    if (!oldestAssignedAt) continue;

    const ageDays = Math.floor((now - new Date(oldestAssignedAt).getTime()) / 86_400_000);
    if (ageDays < 7) continue; // Not old enough yet

    const total   = repLeads.length;
    const worked  = repLeads.filter((l) => l.status !== "new").length;
    const workedPct = total > 0 ? (worked * 100) / total : 0;

    // Determine which statuses to pull based on age + worked %
    let pullStatuses: string[] = [];
    let reason = "";

    if (ageDays >= 21) {
      // 3+ weeks: pull all completely unworked and low-progress
      pullStatuses = ["new", "attempted", "contacted"];
      reason = `Auto-pulled: ${ageDays}d old, ${workedPct.toFixed(0)}% worked (21-day threshold)`;
    } else if (ageDays >= 14 && workedPct < 60) {
      // 2 weeks, < 60% worked
      pullStatuses = ["new", "attempted"];
      reason = `Auto-pulled: ${ageDays}d old, ${workedPct.toFixed(0)}% worked (14-day / <60% threshold)`;
    } else if (ageDays >= 7 && workedPct < 30) {
      // 1 week, < 30% worked
      pullStatuses = ["new"];
      reason = `Auto-pulled: ${ageDays}d old, ${workedPct.toFixed(0)}% worked (7-day / <30% threshold)`;
    }

    if (!pullStatuses.length) continue;

    const toPullIds = repLeads
      .filter((l) => pullStatuses.includes(l.status))
      .map((l) => l.id);

    if (!toPullIds.length) continue;

    const { error: updateErr } = await admin
      .from("leads")
      .update({
        assigned_to:    null,
        assigned_at:    null,
        pulled_at:      nowIso,
        pulled_by:      null, // system pull
        cooldown_until: cooldownUntil,
        pull_reason:    reason,
        updated_at:     nowIso,
      })
      .in("id", toPullIds);

    if (updateErr) {
      console.error(`[lead-expiry cron] update error for rep ${repId}:`, updateErr.message);
      continue;
    }

    // Activity log
    await admin.from("sales_activity_log").insert(
      toPullIds.map((id) => ({
        org_id:     orgId,
        lead_id:    id,
        actor_id:   repId, // log against rep for manager visibility
        event_type: "lead_auto_pulled",
        summary:    reason,
        is_incident: false,
        metadata:   { auto: true, age_days: ageDays, worked_pct: workedPct, cooldown_until: cooldownUntil },
      }))
    );

    totalPulled += toPullIds.length;
    pullLog.push({ org_id: orgId, rep_id: repId, pulled: toPullIds.length, reason });
  }

  return NextResponse.json({ ok: true, total_pulled: totalPulled, log: pullLog });
}
