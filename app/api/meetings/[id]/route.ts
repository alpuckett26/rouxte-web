import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteDailyRoom } from "@/lib/daily/api";

interface Params { params: Promise<{ id: string }> }

/** PATCH /api/meetings/[id] — end a meeting or update title/scheduled_at */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles").select("org_id, role").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const { data: meeting } = await admin
    .from("meetings").select("*").eq("id", id).eq("org_id", profile.org_id).maybeSingle();
  if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });

  // Only creator or admin/manager can update
  const canManage =
    meeting.created_by === user.id ||
    ["admin", "sales_manager"].includes(profile.role);
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.title)        updates.title        = body.title.trim();
  if (body.scheduled_at) updates.scheduled_at = body.scheduled_at;
  if (body.status === "live" && meeting.status === "waiting") {
    updates.status = "live";
  }
  if (body.status === "ended" && meeting.status !== "ended") {
    updates.status   = "ended";
    updates.ended_at = new Date().toISOString();
    // Optionally delete the Daily room to free capacity
    await deleteDailyRoom(meeting.room_name).catch(() => {});
  }

  const { data, error } = await admin
    .from("meetings").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

/** GET /api/meetings/[id] — single meeting details */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles").select("org_id").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const { data: meeting } = await admin
    .from("meetings").select("*").eq("id", id).eq("org_id", profile.org_id).maybeSingle();
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ data: meeting });
}
