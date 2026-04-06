import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface ImportRow {
  address: string;
  customer_name?: string;
  phone?: string;
  notes?: string;
  lat?: number | null;
  lng?: number | null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });
  if (!["admin", "sales_manager", "team_lead"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const rows: ImportRow[] = body.rows ?? [];

  if (!rows.length) return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  if (rows.length > 5000) return NextResponse.json({ error: "Max 5000 rows per import" }, { status: 400 });

  const inserts = rows.map((row) => ({
    org_id: profile.org_id,
    created_by: user.id,
    address: row.address.trim(),
    customer_name: row.customer_name?.trim() || null,
    phone: row.phone?.trim() || null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    carrier_availability: {},
    status: "new" as const,
    source: "import",
  }));

  const { data, error } = await admin
    .from("leads")
    .insert(inserts)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log notes as lead notes if provided
  if (body.notes_map) {
    const notesMap: Record<number, string> = body.notes_map;
    const noteInserts = (data ?? [])
      .map((lead, i) => notesMap[i] ? { lead_id: lead.id, author_id: user.id, body: notesMap[i] } : null)
      .filter(Boolean);
    if (noteInserts.length) {
      await admin.from("lead_notes").insert(noteInserts);
    }
  }

  return NextResponse.json({ imported: data?.length ?? 0 });
}
