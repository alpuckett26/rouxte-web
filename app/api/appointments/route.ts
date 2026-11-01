import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDailyRoom } from "@/lib/daily/api";
import {
  ANSWERS_SOURCE,
  mapRouxteStatusToLifecycle,
  pushAnswersLifecycle,
} from "@/lib/answers/client";
import {
  loadActor,
  isManager,
  isMissingTable,
  migrationPending,
  nameMap,
} from "@/lib/appointments/actor";

/**
 * The setter → closer handoff (rouxte-web#19, Phase 1).
 *
 * GET  /api/appointments   — list, filtered. Defaults to the caller's own.
 * POST /api/appointments   — a setter books an appointment on a lead.
 *
 * Reuse, not rebuild: the video room comes from the existing `meetings` table
 * via Daily, the lead stays the single source of lead truth, and the outcome
 * is recorded in the existing append-only `sales_activity_log`.
 */

/** How far into the past a booking is still plausibly a backfill, not a typo. */
const PAST_BOOKING_GRACE_MS = 60 * 60 * 1000;

const APPOINTMENT_COLUMNS = "*";

function textArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0);
}

export async function GET(request: NextRequest) {
  const a = await loadActor();
  if ("error" in a) return a.error;
  const { actor } = a;

  const params = request.nextUrl.searchParams;
  const scope = params.get("scope") ?? "mine";
  const leadId = params.get("lead_id");
  const includeSettled = params.get("include_settled") === "1";

  const admin = createAdminClient();
  let query = admin
    .from("sales_appointments")
    .select(APPOINTMENT_COLUMNS)
    .eq("org_id", actor.orgId)
    .order("scheduled_at", { ascending: true })
    .limit(200);

  if (leadId) query = query.eq("lead_id", leadId);
  if (!includeSettled) query = query.is("outcome", null);

  // A rep asking for "org" gets their own — the filter is not a suggestion.
  if (scope !== "org" || !isManager(actor.role)) {
    query = query.or(`setter_id.eq.${actor.userId},closer_id.eq.${actor.userId}`);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error)) return migrationPending();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const names = await nameMap(admin, rows.flatMap((r) => [r.setter_id, r.closer_id]));

  return NextResponse.json({
    data: rows.map((r) => ({
      ...r,
      setter_name: names[r.setter_id] ?? null,
      closer_name: r.closer_id ? names[r.closer_id] ?? null : null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const a = await loadActor();
  if ("error" in a) return a.error;
  const { actor } = a;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const leadId = typeof body.lead_id === "string" ? body.lead_id : "";
  if (!leadId) return NextResponse.json({ error: "lead_id is required" }, { status: 400 });

  // The handoff is the product. A booking with no qualification notes is a
  // calendar entry, and handing a closer a calendar entry is precisely the
  // failure this object exists to stop — so it is refused here as well as by
  // the NOT NULL in migration 043.
  const qualificationNotes =
    typeof body.qualification_notes === "string" ? body.qualification_notes.trim() : "";
  if (!qualificationNotes) {
    return NextResponse.json(
      {
        error:
          "qualification_notes is required — a booking with no qualification is a " +
          "calendar entry, not a handoff.",
      },
      { status: 400 },
    );
  }

  const scheduledRaw = typeof body.scheduled_at === "string" ? body.scheduled_at : "";
  const scheduledMs = Date.parse(scheduledRaw);
  if (!scheduledRaw || Number.isNaN(scheduledMs)) {
    return NextResponse.json(
      { error: "scheduled_at must be an ISO 8601 datetime" },
      { status: 400 },
    );
  }
  if (scheduledMs < Date.now() - PAST_BOOKING_GRACE_MS) {
    return NextResponse.json(
      { error: "scheduled_at is in the past — book the appointment, do not backdate it." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // The lead must be ours. Read through the service-role client and check
  // org_id explicitly rather than trusting the caller's id.
  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .select("id, org_id, status, customer_name, address, external_source, external_ref, assigned_to")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 });
  if (!lead || lead.org_id !== actor.orgId) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // A closer, if named, must be in the same org. Unnamed is legal: the
  // appointment goes into the pool and a closer claims it.
  const closerId = typeof body.closer_id === "string" && body.closer_id ? body.closer_id : null;
  if (closerId) {
    const { data: closer } = await admin
      .from("user_profiles")
      .select("user_id, org_id")
      .eq("user_id", closerId)
      .maybeSingle();
    if (!closer || closer.org_id !== actor.orgId) {
      return NextResponse.json({ error: "closer_id is not a member of this org" }, { status: 400 });
    }
  }

  const durationRaw = Number(body.duration_minutes);
  const duration =
    Number.isFinite(durationRaw) && durationRaw >= 5 && durationRaw <= 480
      ? Math.round(durationRaw)
      : 30;

  const fitRaw = Number(body.estimated_fit);
  const estimatedFit = Number.isFinite(fitRaw) && fitRaw >= 1 && fitRaw <= 5 ? Math.round(fitRaw) : null;

  // Optional Daily room for the closer's JOIN button. If Daily is not
  // configured we still book the appointment — but we SAY that no room was
  // created rather than returning a clean 201 with a silently missing room.
  let meetingId: string | null = null;
  let meetingUrl: string | null = null;
  let meetingSkipped: string | null = null;

  if (body.create_meeting === true) {
    if (!process.env.DAILY_API_KEY) {
      meetingSkipped = "DAILY_API_KEY is not configured — appointment booked without a video room.";
    } else {
      try {
        const slug = `rouxte-appt-${actor.orgId.slice(0, 8)}-${Date.now()}`;
        const room = await createDailyRoom({ name: slug, expiresIn: 8 * 60 * 60 });
        const { data: meeting, error: meetingErr } = await admin
          .from("meetings")
          .insert({
            org_id: actor.orgId,
            created_by: actor.userId,
            title: `Sales appointment — ${lead.customer_name ?? lead.address}`,
            room_name: room.name,
            room_url: room.url,
            meeting_type: "scheduled",
            scheduled_at: new Date(scheduledMs).toISOString(),
            status: "waiting",
          })
          .select("id, room_url")
          .single();
        if (meetingErr) {
          meetingSkipped = `Daily room created but meetings insert failed: ${meetingErr.message}`;
        } else {
          meetingId = meeting.id as string;
          meetingUrl = meeting.room_url as string;
        }
      } catch (e) {
        meetingSkipped = e instanceof Error ? e.message : "Unknown error creating Daily room";
      }
    }
  }

  const { data: appointment, error } = await admin
    .from("sales_appointments")
    .insert({
      org_id: actor.orgId,
      lead_id: leadId,
      setter_id: actor.userId,
      closer_id: closerId,
      meeting_id: meetingId,
      scheduled_at: new Date(scheduledMs).toISOString(),
      duration_minutes: duration,
      qualification_notes: qualificationNotes,
      decision_maker: typeof body.decision_maker === "string" ? body.decision_maker.trim() || null : null,
      decision_maker_present:
        typeof body.decision_maker_present === "boolean" ? body.decision_maker_present : null,
      pain_points: textArray(body.pain_points),
      known_objections: textArray(body.known_objections),
      estimated_fit: estimatedFit,
    })
    .select(APPOINTMENT_COLUMNS)
    .single();

  if (error) {
    if (isMissingTable(error)) return migrationPending();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Move the lead to 'appointment' and record it in the existing rails: the
  // status history, the append-only activity log, and — for Anseur-sourced
  // leads — the spine. This is the same push the lead PATCH route makes; a
  // booking is a rep milestone by any other name.
  const priorStatus = lead.status as string;
  if (priorStatus !== "sold" && priorStatus !== "appointment") {
    await admin
      .from("leads")
      .update({
        status: "appointment",
        appointment_at: new Date(scheduledMs).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    await admin.from("lead_status_history").insert({
      lead_id: leadId,
      from_status: priorStatus,
      to_status: "appointment",
      changed_by: actor.userId,
    });
  } else {
    await admin
      .from("leads")
      .update({ appointment_at: new Date(scheduledMs).toISOString(), updated_at: new Date().toISOString() })
      .eq("id", leadId);
  }

  await admin.from("sales_activity_log").insert({
    org_id: actor.orgId,
    lead_id: leadId,
    actor_id: actor.userId,
    team_id: actor.teamId,
    event_type: "appointment_set",
    summary: `Appointment set for ${new Date(scheduledMs).toISOString()}`,
    metadata: {
      appointment_id: appointment.id,
      closer_id: closerId,
      estimated_fit: estimatedFit,
      meeting_id: meetingId,
    },
    is_incident: false,
  });

  const lifecycle = mapRouxteStatusToLifecycle("appointment");
  if (
    lifecycle &&
    process.env.ANSWERS_API_URL &&
    lead.external_source === ANSWERS_SOURCE &&
    lead.external_ref
  ) {
    const externalRef = lead.external_ref as string;
    after(async () => {
      await pushAnswersLifecycle(externalRef, lifecycle, actor.fullName);
    });
  }

  return NextResponse.json(
    {
      data: { ...appointment, setter_name: actor.fullName, meeting_url: meetingUrl },
      // Present and non-null ONLY when a room was asked for and not produced.
      meeting_skipped_reason: meetingSkipped,
    },
    { status: 201 },
  );
}
