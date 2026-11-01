import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadActor,
  isMissingTable,
  migrationPending,
  nameMap,
} from "@/lib/appointments/actor";

/**
 * GET /api/appointments/[id]/brief — the closer's prep brief
 * (rouxte-web#19, Phase 1).
 *
 * ASSEMBLED, NEVER STORED. Every field here already lives somewhere: the
 * setter's handoff on the appointment, the lead record, `lead_notes`,
 * `lead_status_history`, `competitor_intel`, and the Daily room on `meetings`.
 * A brief that were stored would be a fifth copy of all of it, stale the moment
 * a rep adds a note.
 */

/** Notes and history are context, not an archive — cap them at a readable page. */
const NOTE_LIMIT = 20;
const HISTORY_LIMIT = 20;
const INTEL_LIMIT = 25;

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const a = await loadActor();
  if ("error" in a) return a.error;
  const { actor } = a;

  const admin = createAdminClient();

  const { data: appointment, error } = await admin
    .from("sales_appointments")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) return migrationPending();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Same 404 for "no such appointment" and "not yours" — the difference is
  // information about another org.
  if (!appointment || appointment.org_id !== actor.orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const leadId = appointment.lead_id as string;

  const [leadRes, notesRes, historyRes, intelRes, priorRes, meetingRes, names] =
    await Promise.all([
      admin.from("leads").select("*").eq("id", leadId).maybeSingle(),
      admin
        .from("lead_notes")
        .select("*")
        .eq("lead_id", leadId)
        .order("ts", { ascending: false })
        .limit(NOTE_LIMIT),
      admin
        .from("lead_status_history")
        .select("*")
        .eq("lead_id", leadId)
        .order("ts", { ascending: false })
        .limit(HISTORY_LIMIT),
      // Global rows (org_id null) plus this org's own. The closer needs both:
      // the shared competitor sheet and whatever their manager added.
      admin
        .from("competitor_intel")
        .select("*")
        .eq("active", true)
        .or(`org_id.is.null,org_id.eq.${actor.orgId}`)
        .order("competitor", { ascending: true })
        .limit(INTEL_LIMIT),
      // Earlier attempts on this lead. A second sit with the same objection is
      // the single most useful thing a closer can walk in already knowing.
      admin
        .from("sales_appointments")
        .select("*")
        .eq("lead_id", leadId)
        .neq("id", id)
        .order("scheduled_at", { ascending: false })
        .limit(10),
      appointment.meeting_id
        ? admin.from("meetings").select("room_url").eq("id", appointment.meeting_id).maybeSingle()
        : Promise.resolve({ data: null }),
      nameMap(admin, [appointment.setter_id, appointment.closer_id]),
    ]);

  return NextResponse.json({
    data: {
      appointment,
      lead: leadRes.data ?? null,
      setter_name: names[appointment.setter_id as string] ?? null,
      closer_name: appointment.closer_id
        ? names[appointment.closer_id as string] ?? null
        : null,
      meeting_url: (meetingRes.data as { room_url?: string } | null)?.room_url ?? null,
      notes: notesRes.data ?? [],
      status_history: historyRes.data ?? [],
      competitor_intel: intelRes.data ?? [],
      prior_appointments: priorRes.data ?? [],
    },
  });
}
