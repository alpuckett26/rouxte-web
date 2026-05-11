import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomBytes } from "crypto";

async function getOrgId(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_profiles")
    .select("org_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.org_id ?? null;
}

// GET /api/qr-codes — list QR codes for the authenticated user's org
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getOrgId(user.id);
  if (!orgId) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("qr_codes")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/qr-codes — create a new QR code for the org
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getOrgId(user.id);
  if (!orgId) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const campaign: string | null = body.campaign?.trim() || null;

  // Generate a collision-resistant 12-char hex code
  const code = randomBytes(6).toString("hex");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("qr_codes")
    .insert({ org_id: orgId, code, campaign })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
