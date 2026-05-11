import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDailyRoom } from "@/lib/daily/api";

/**
 * GET /api/meetings
 * Returns org meetings: upcoming scheduled + recent (last 20).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles").select("org_id").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const { data: meetings } = await admin
    .from("meetings")
    .select("*")
    .eq("org_id", profile.org_id)
    .neq("status", "ended")
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: recent } = await admin
    .from("meetings")
    .select("*")
    .eq("org_id", profile.org_id)
    .eq("status", "ended")
    .order("ended_at", { ascending: false })
    .limit(10);

  return NextResponse.json({ data: { active: meetings ?? [], recent: recent ?? [] } });
}

/**
 * POST /api/meetings
 * Create a new meeting (instant or scheduled).
 *
 * Body:
 *   title         string       — meeting name
 *   meeting_type  'instant' | 'scheduled'
 *   scheduled_at  string?      — ISO datetime for scheduled meetings
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.DAILY_API_KEY) {
    return NextResponse.json({ error: "DAILY_API_KEY not configured" }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles").select("org_id, role, full_name").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const body = await request.json();
  const title: string        = body.title?.trim() || "Team Meeting";
  const meetingType: string  = body.meeting_type === "scheduled" ? "scheduled" : "instant";
  const scheduledAt: string | undefined = body.scheduled_at;

  // Build a unique Daily room slug: org-prefix + timestamp
  const slug = `rouxte-${profile.org_id.slice(0, 8)}-${Date.now()}`;

  // Create room on Daily — expires in 8h to cover long scheduled meetings
  const room = await createDailyRoom({ name: slug, expiresIn: 8 * 60 * 60 });

  const { data: meeting, error } = await admin
    .from("meetings")
    .insert({
      org_id:       profile.org_id,
      created_by:   user.id,
      title,
      room_name:    room.name,
      room_url:     room.url,
      meeting_type: meetingType,
      scheduled_at: scheduledAt ?? null,
      status:       meetingType === "instant" ? "live" : "waiting",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: meeting }, { status: 201 });
}
