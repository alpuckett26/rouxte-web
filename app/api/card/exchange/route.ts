import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { repUserId, name, phone, email, address } = body;

  if (!repUserId || !name || !phone) {
    return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id, card_enabled")
    .eq("user_id", repUserId)
    .maybeSingle();

  if (!profile || profile.card_enabled === false) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const { error } = await admin.from("leads").insert({
    org_id:       profile.org_id,
    created_by:   repUserId,
    assigned_to:  repUserId,
    assigned_at:  new Date().toISOString(),
    address:      address?.trim() || `${name} (card exchange)`,
    customer_name: name.trim(),
    phone:        phone.trim(),
    source:       "card_exchange",
    status:       "interested",
    carrier_availability: {},
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
