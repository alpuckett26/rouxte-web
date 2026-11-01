import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadActor,
  isManager,
  isMissingTable,
  migrationPending,
  nameMap,
} from "@/lib/appointments/actor";

/**
 * GET   /api/appointments/[id]  — one appointment (rouxte-web#19, Phase 1).
 * PATCH /api/appointments/[id]  — claim, reassign, reschedule, or amend the
 *                                 setter's handoff.
 *
 * Outcomes are NOT set here. They go through POST
 * /api/appointments/[id]/outcome, which also writes the activity log and the
 * attribution — three writes that must not be reachable by a stray PATCH.
 */

interface Ctx {
  params: Promise<{ id: string }>;
}

async function loadOwned(id: string, orgId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sales_appointments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return { error };
  if (!data || data.org_id !== orgId) return { notFound: true as const };
  return { appointment: data, admin };
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const a = await loadActor();
  if ("error" in a) return a.error;

  const res = await loadOwned(id, a.actor.orgId);
  if ("error" in res && res.error) {
    if (isMissingTable(res.error)) return migrationPending();
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }
  if ("notFound" in res) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const names = await nameMap(res.admin!, [
    res.appointment!.setter_id,
    res.appointment!.closer_id,
  ]);
  return NextResponse.json({
    data: {
      ...res.appointment,
      setter_name: names[res.appointment!.setter_id as string] ?? null,
      closer_name: res.appointment!.closer_id
        ? names[res.appointment!.closer_id as string] ?? null
        : null,
    },
  });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const a = await loadActor();
  if ("error" in a) return a.error;
  const { actor } = a;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const res = await loadOwned(id, actor.orgId);
  if ("error" in res && res.error) {
    if (isMissingTable(res.error)) return migrationPending();
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }
  if ("notFound" in res) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const appt = res.appointment!;
  const admin = res.admin!;

  if (appt.outcome) {
    return NextResponse.json(
      { error: "This appointment is settled. Amend it by booking a new one." },
      { status: 409 },
    );
  }

  const isParty = appt.setter_id === actor.userId || appt.closer_id === actor.userId;
  const update: Record<string, unknown> = {};

  // ── Claim ────────────────────────────────────────────────────────────────
  // Anyone in the org may claim an UNCLAIMED appointment. Taking one off
  // another closer is a manager action.
  if ("closer_id" in body) {
    const next = typeof body.closer_id === "string" && body.closer_id ? body.closer_id : null;
    const stealing = appt.closer_id !== null && appt.closer_id !== actor.userId;
    if (stealing && !isManager(actor.role)) {
      return NextResponse.json(
        { error: "This appointment already has a closer. Only a manager can reassign it." },
        { status: 403 },
      );
    }
    if (next) {
      const { data: member } = await admin
        .from("user_profiles")
        .select("user_id, org_id")
        .eq("user_id", next)
        .maybeSingle();
      if (!member || member.org_id !== actor.orgId) {
        return NextResponse.json(
          { error: "closer_id is not a member of this org" },
          { status: 400 },
        );
      }
    }
    update.closer_id = next;
  }

  // ── Everything else is the setter's handoff, or the time ─────────────────
  const mayAmend = isParty || isManager(actor.role);
  const amendKeys = [
    "qualification_notes",
    "decision_maker",
    "decision_maker_present",
    "pain_points",
    "known_objections",
    "estimated_fit",
    "scheduled_at",
    "duration_minutes",
  ];
  const wantsAmend = amendKeys.some((k) => k in body);
  if (wantsAmend && !mayAmend) {
    return NextResponse.json(
      { error: "Only the setter, the closer, or a manager may amend this appointment" },
      { status: 403 },
    );
  }

  if (typeof body.qualification_notes === "string") {
    const notes = body.qualification_notes.trim();
    if (!notes) {
      return NextResponse.json(
        { error: "qualification_notes cannot be emptied — it is the handoff." },
        { status: 400 },
      );
    }
    update.qualification_notes = notes;
  }
  if ("decision_maker" in body) {
    update.decision_maker =
      typeof body.decision_maker === "string" ? body.decision_maker.trim() || null : null;
  }
  if ("decision_maker_present" in body) {
    update.decision_maker_present =
      typeof body.decision_maker_present === "boolean" ? body.decision_maker_present : null;
  }
  for (const key of ["pain_points", "known_objections"] as const) {
    if (key in body) {
      update[key] = Array.isArray(body[key])
        ? (body[key] as unknown[])
            .map((v) => (typeof v === "string" ? v.trim() : ""))
            .filter(Boolean)
        : [];
    }
  }
  if ("estimated_fit" in body) {
    const fit = Number(body.estimated_fit);
    update.estimated_fit = Number.isFinite(fit) && fit >= 1 && fit <= 5 ? Math.round(fit) : null;
  }
  if (typeof body.scheduled_at === "string") {
    const ms = Date.parse(body.scheduled_at);
    if (Number.isNaN(ms)) {
      return NextResponse.json(
        { error: "scheduled_at must be an ISO 8601 datetime" },
        { status: 400 },
      );
    }
    update.scheduled_at = new Date(ms).toISOString();
  }
  if ("duration_minutes" in body) {
    const d = Number(body.duration_minutes);
    if (!Number.isFinite(d) || d < 5 || d > 480) {
      return NextResponse.json(
        { error: "duration_minutes must be between 5 and 480" },
        { status: 400 },
      );
    }
    update.duration_minutes = Math.round(d);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("sales_appointments")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // A time change moves the lead's appointment_at with it, so the map and the
  // lead card do not keep showing yesterday.
  if (update.scheduled_at) {
    await admin
      .from("leads")
      .update({ appointment_at: update.scheduled_at, updated_at: new Date().toISOString() })
      .eq("id", appt.lead_id);
  }

  return NextResponse.json({ data });
}
