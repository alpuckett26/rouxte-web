import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { address, qr_code } = await request.json();

  if (!address?.trim()) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }

  const supabase = await createClient();

  // Look up org via QR code
  const { data: qr } = await supabase
    .from("qr_codes")
    .select("org_id")
    .eq("code", qr_code)
    .maybeSingle();

  if (!qr) {
    return NextResponse.json({ error: "Invalid QR code" }, { status: 404 });
  }

  const normalized = address.toLowerCase().trim();

  // Upsert opt-out record
  const { error } = await supabase.from("opt_out_addresses").upsert(
    {
      org_id: qr.org_id,
      normalized_address: normalized,
      source: "qr",
      created_by: null,
    },
    { onConflict: "org_id,normalized_address" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark matching lead as opt-out if found
  await supabase
    .from("leads")
    .update({ is_opt_out: true, updated_at: new Date().toISOString() })
    .eq("org_id", qr.org_id)
    .ilike("address", `%${address.split(",")[0].trim()}%`);

  return NextResponse.json({ ok: true });
}
