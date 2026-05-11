import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lat, lng, accuracy } = await request.json() as {
    lat: number; lng: number; accuracy?: number;
  };

  if (!lat || !lng) return NextResponse.json({ error: "lat/lng required" }, { status: 400 });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  await supabase.from("rep_locations").upsert({
    user_id: user.id,
    org_id: profile.org_id,
    lat,
    lng,
    accuracy: accuracy ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  return NextResponse.json({ ok: true });
}
