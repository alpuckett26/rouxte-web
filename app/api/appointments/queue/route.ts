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
 * GET /api/appointments/queue — the closer's day (rouxte-web#19, Phase 1).
 *
 * Query:
 *   ?date=YYYY-MM-DD   the day to show, in the caller's own offset (see below).
 *                      Default: an open-ended "from now" queue.
 *   ?closer_id=<uuid>  look at someone else's day. Managers only.
 *   ?tz_offset=<mins>  the browser's getTimezoneOffset(), so "today" means the
 *                      closer's today and not the server's.
 *
 * Returns THREE buckets, deliberately separate:
 *   mine       — assigned to this closer, still pending
 *   pool       — booked but unclaimed; anyone in the org may claim them
 *   overdue    — pending appointments whose time has already passed
 *
 * `overdue` is its own bucket rather than being folded into `mine` because an
 * appointment that has come and gone with no outcome is a DIFFERENT thing from
 * one that is coming up, and a queue that quietly sorts it to the top of the
 * list is a queue that lets it be missed.
 */
export async function GET(request: NextRequest) {
  const a = await loadActor();
  if ("error" in a) return a.error;
  const { actor } = a;

  const params = request.nextUrl.searchParams;

  const requestedCloser = params.get("closer_id");
  if (requestedCloser && requestedCloser !== actor.userId && !isManager(actor.role)) {
    return NextResponse.json(
      { error: "Only managers may view another closer's queue" },
      { status: 403 },
    );
  }
  const closerId = requestedCloser ?? actor.userId;

  // Day window. tz_offset is minutes WEST of UTC (JS getTimezoneOffset), so
  // local midnight is UTC midnight plus that offset.
  const date = params.get("date");
  const offsetRaw = Number(params.get("tz_offset"));
  const offsetMin = Number.isFinite(offsetRaw) ? Math.max(-840, Math.min(840, offsetRaw)) : 0;

  let from: string;
  let to: string | null = null;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const startUtc = Date.parse(`${date}T00:00:00.000Z`);
    if (Number.isNaN(startUtc)) {
      return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }
    from = new Date(startUtc + offsetMin * 60_000).toISOString();
    to = new Date(startUtc + offsetMin * 60_000 + 24 * 60 * 60_000).toISOString();
  } else {
    from = new Date().toISOString();
  }

  const admin = createAdminClient();

  const base = () => {
    let q = admin
      .from("sales_appointments")
      .select("*")
      .eq("org_id", actor.orgId)
      .is("outcome", null)
      .order("scheduled_at", { ascending: true })
      .limit(200);
    q = q.gte("scheduled_at", from);
    if (to) q = q.lt("scheduled_at", to);
    return q;
  };

  const [mineRes, poolRes, overdueRes] = await Promise.all([
    base().eq("closer_id", closerId),
    base().is("closer_id", null),
    admin
      .from("sales_appointments")
      .select("*")
      .eq("org_id", actor.orgId)
      .eq("closer_id", closerId)
      .is("outcome", null)
      .lt("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50),
  ]);

  const firstError = mineRes.error ?? poolRes.error ?? overdueRes.error;
  if (firstError) {
    if (isMissingTable(firstError)) return migrationPending();
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const all = [...(mineRes.data ?? []), ...(poolRes.data ?? []), ...(overdueRes.data ?? [])];

  // Hydrate the handful of lead + person + room fields a queue row shows.
  // Three lookups for the whole page, not one per row.
  const leadIds = [...new Set(all.map((r) => r.lead_id as string))];
  const meetingIds = [...new Set(all.map((r) => r.meeting_id).filter(Boolean) as string[])];

  const [leadsRes, meetingsRes, names] = await Promise.all([
    leadIds.length
      ? admin
          .from("leads")
          .select("id, customer_name, address, phone, status")
          .in("id", leadIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    meetingIds.length
      ? admin.from("meetings").select("id, room_url").in("id", meetingIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    nameMap(admin, all.flatMap((r) => [r.setter_id, r.closer_id])),
  ]);

  const leadsById: Record<string, unknown> = {};
  for (const l of leadsRes.data ?? []) leadsById[(l as { id: string }).id] = l;
  const roomById: Record<string, string> = {};
  for (const m of meetingsRes.data ?? []) {
    const row = m as { id: string; room_url: string | null };
    if (row.room_url) roomById[row.id] = row.room_url;
  }

  const hydrate = (rows: Record<string, unknown>[]) =>
    rows.map((r) => ({
      ...r,
      lead: leadsById[r.lead_id as string] ?? null,
      setter_name: names[r.setter_id as string] ?? null,
      closer_name: r.closer_id ? names[r.closer_id as string] ?? null : null,
      meeting_url: r.meeting_id ? roomById[r.meeting_id as string] ?? null : null,
    }));

  return NextResponse.json({
    data: {
      closer_id: closerId,
      window: { from, to },
      mine: hydrate(mineRes.data ?? []),
      pool: hydrate(poolRes.data ?? []),
      overdue: hydrate(overdueRes.data ?? []),
    },
  });
}
