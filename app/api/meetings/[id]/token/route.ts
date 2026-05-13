import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDailyToken } from "@/lib/daily/api";

interface Params { params: Promise<{ id: string }> }

/**
 * POST /api/meetings/[id]/token
 * Generates a Daily meeting token for the calling user.
 * Returns { token, room_url } so the client can join the call.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
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

  const { data: meeting } = await admin
    .from("meetings").select("*").eq("id", id).eq("org_id", profile.org_id).maybeSingle();
  if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  if (meeting.status === "ended") return NextResponse.json({ error: "Meeting has ended" }, { status: 410 });

  const isOwner = meeting.created_by === user.id || ["admin", "sales_manager"].includes(profile.role);
  const userName = profile.full_name || user.email?.split("@")[0] || "Guest";

  let token: string;
  try {
    const res = await createDailyToken({
      roomName: meeting.room_name,
      userId:   user.id,
      userName,
      isOwner,
    });
    token = res.token;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error creating Daily token";
    console.error("[/api/meetings/:id/token POST] Daily token creation failed:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Mark meeting as live when someone joins (in case it was waiting)
  if (meeting.status === "waiting") {
    await admin.from("meetings").update({ status: "live" }).eq("id", id);
  }

  return NextResponse.json({ token, room_url: meeting.room_url, room_name: meeting.room_name });
}
