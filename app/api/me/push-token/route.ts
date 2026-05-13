import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/me/push-token
 *   { token: string, platform: 'android' | 'ios', app_version?: string }
 *
 * Upserts a device push token for the authenticated user. The mobile app
 * calls this on first launch after FCM grants a token, and again on token
 * refresh events. Tokens are unique across the table so re-installs and
 * device transfers don't pile up dead rows.
 *
 * DELETE /api/me/push-token
 *   { token: string }
 *
 * Removes the token on sign-out so a future sign-in doesn't deliver
 * the previous user's pushes.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.token !== "string" || !body.token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }
  if (body.platform !== "android" && body.platform !== "ios") {
    return NextResponse.json({ error: "platform must be 'android' or 'ios'" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("device_push_tokens")
    .upsert(
      {
        user_id:      user.id,
        token:        body.token,
        platform:     body.platform,
        app_version:  typeof body.app_version === "string" ? body.app_version : null,
        last_seen_at: new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      },
      { onConflict: "token" },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.token !== "string" || !body.token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("device_push_tokens")
    .delete()
    .eq("user_id", user.id)
    .eq("token", body.token);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
