import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Batch check FCC coverage for multiple lat/lng points.
// Returns an array of booleans in the same order as the input points.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const points: { lat: number; lng: number }[] = body.points ?? [];

  if (!points.length) return NextResponse.json({ results: [] });
  if (points.length > 600) return NextResponse.json({ error: "Max 600 points per batch" }, { status: 400 });

  const admin = createAdminClient();

  // Build a VALUES list and do one spatial query for all points
  const values = points
    .map((p, i) => `(${i}, ST_SetSRID(ST_Point(${p.lng}, ${p.lat}), 4326)::geography)`)
    .join(", ");

  const { data, error } = await admin.rpc("batch_fcc_check", { points_json: JSON.stringify(points) });

  if (error) {
    // Fallback: check each point individually if RPC doesn't exist yet
    const results = await Promise.all(
      points.map(async (p) => {
        if (p.lat == null || p.lng == null) return false;
        const { data: d } = await admin.rpc("fcc_att_available", { lat: p.lat, lng: p.lng });
        return !!d;
      })
    );
    return NextResponse.json({ results });
  }

  return NextResponse.json({ results: data });
}
