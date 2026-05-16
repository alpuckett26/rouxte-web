import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { LeadStatus } from "@/lib/types";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const carrier    = searchParams.get("carrier");
  const status     = searchParams.get("status") as LeadStatus | null;
  const tags       = searchParams.get("tags")?.split(",").filter(Boolean);
  const isDNK      = searchParams.get("is_do_not_knock");
  const assignedTo = searchParams.get("assigned_to");
  const page       = parseInt(searchParams.get("page") ?? "1");
  const pageSize   = Math.min(parseInt(searchParams.get("page_size") ?? "50"), 2000);

  // `planned` count: Postgres estimates from the query plan instead of a
  // full row count. Orders of magnitude faster on large leads tables —
  // the badge value is approximate, which is fine for UX (we never use
  // the count for math/pagination correctness).
  let query = supabase
    .from("leads")
    .select("*", { count: "planned" })
    .order("updated_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status)     query = query.eq("status", status);
  if (isDNK !== null) query = query.eq("is_do_not_knock", isDNK === "true");
  if (carrier === "att") query = query.eq("carrier_availability->att", true);
  if (assignedTo) query = query.eq("assigned_to", assignedTo);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, total: count, page, page_size: pageSize });
}

/** ~11m at the equator — close enough to consider two clicks the same address. */
const DEDUPE_TOLERANCE_DEG = 0.0001;

function normalizeAddress(s: string | null | undefined): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    // strip trailing ", USA" / ", United States" etc to match across geocoder variants
    .replace(/,\s*(usa|united states|us)\.?$/i, "")
    .trim();
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.org_id) return NextResponse.json({ error: "Profile not found — complete onboarding first." }, { status: 400 });

  const body = await request.json();
  const incomingAddress = typeof body.address === "string" ? body.address : null;
  const incomingLat = typeof body.lat === "number" ? body.lat : null;
  const incomingLng = typeof body.lng === "number" ? body.lng : null;
  const hasCoords = incomingLat !== null && incomingLng !== null && (incomingLat !== 0 || incomingLng !== 0);

  // ── Dedupe: return the existing lead if there's already one at this spot
  //
  // Match strategy (cheap-first):
  //   1. If we have real coords, look for any lead in the org whose lat/lng
  //      is within ~11m of the incoming coords (DEDUPE_TOLERANCE_DEG).
  //   2. Otherwise (typed-in address, no coords), match on normalized address
  //      exact.
  //
  // We do the row lookup over the admin client (RLS is org-scoped via the
  // .eq("org_id") filter), and bias newest-first so re-captures of an old
  // address return the most recent record.
  let existing: { id: string; address: string; lat: number | null; lng: number | null } | null = null;

  if (hasCoords) {
    const { data: nearby } = await admin
      .from("leads")
      .select("id, address, lat, lng")
      .eq("org_id", profile.org_id)
      .gte("lat", incomingLat - DEDUPE_TOLERANCE_DEG)
      .lte("lat", incomingLat + DEDUPE_TOLERANCE_DEG)
      .gte("lng", incomingLng - DEDUPE_TOLERANCE_DEG)
      .lte("lng", incomingLng + DEDUPE_TOLERANCE_DEG)
      .order("created_at", { ascending: false })
      .limit(1);
    existing = nearby?.[0] ?? null;
  }

  if (!existing && incomingAddress) {
    const normalized = normalizeAddress(incomingAddress);
    if (normalized.length > 0) {
      const { data: byAddress } = await admin
        .from("leads")
        .select("id, address, lat, lng")
        .eq("org_id", profile.org_id)
        // ilike with no wildcards = case-insensitive equality, cheap
        .ilike("address", incomingAddress.trim())
        .order("created_at", { ascending: false })
        .limit(5);
      existing = (byAddress ?? []).find((l) => normalizeAddress(l.address) === normalized) ?? null;
    }
  }

  if (existing) {
    // Return 200 (not 201) with the existing row + a `deduplicated` flag.
    // CaptureLeadModal can use this to show "this address already exists —
    // open the existing lead" instead of pretending we made a new one.
    return NextResponse.json(
      { data: existing, deduplicated: true },
      { status: 200 },
    );
  }

  const { data, error } = await admin
    .from("leads")
    .insert({
      ...body,
      org_id: profile.org_id,
      created_by: user.id,
      source: body.source ?? "map",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data }, { status: 201 });
}
