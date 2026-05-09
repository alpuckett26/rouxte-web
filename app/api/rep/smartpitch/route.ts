import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import QRCode from "qrcode";

function randomSlug(firstName: string): string {
  const base = firstName.toLowerCase().replace(/[^a-z]/g, "").slice(0, 10) || "rep";
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${base}-${suffix}`;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: funnel } = await admin
    .from("lead_funnels")
    .select("*")
    .eq("rep_id", user.id)
    .maybeSingle();

  if (!funnel) {
    return NextResponse.json({ funnel: null, stats: null, recent: [], qr_data_url: null });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.rouxte.com";
  const funnelUrl = `${appUrl}/r/${funnel.slug}`;

  const [qrDataUrl, submissionsResult] = await Promise.all([
    QRCode.toDataURL(funnelUrl, { width: 200, margin: 1, color: { dark: "#0a0f1e", light: "#ffffff" } }),
    admin
      .from("funnel_submissions")
      .select("id, customer_name, phone, lead_score, lead_temperature, recommended_pitch, service_interest, current_provider, switch_timeline, created_at")
      .eq("rep_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const submissions = submissionsResult.data ?? [];
  const stats = {
    total: submissions.length,
    hot:   submissions.filter(s => s.lead_temperature === "hot").length,
    warm:  submissions.filter(s => s.lead_temperature === "warm").length,
    cold:  submissions.filter(s => s.lead_temperature === "cold").length,
  };

  return NextResponse.json({ funnel, stats, recent: submissions, qr_data_url: qrDataUrl, funnel_url: funnelUrl });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Check if funnel already exists
  const { data: existing } = await admin
    .from("lead_funnels")
    .select("id")
    .eq("rep_id", user.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "Funnel already exists" }, { status: 409 });

  // Get rep profile for slug generation
  const { data: profile } = await admin
    .from("user_profiles")
    .select("full_name, org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.org_id) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const firstName = (profile.full_name ?? "rep").split(" ")[0];

  // Try up to 5 slugs to avoid collisions
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = randomSlug(firstName);
    const { data: created, error } = await admin
      .from("lead_funnels")
      .insert({ rep_id: user.id, org_id: profile.org_id, slug, funnel_name: "My SmartPitch Funnel" })
      .select()
      .single();

    if (!error && created) return NextResponse.json({ funnel: created });
    if (error?.code !== "23505") {
      return NextResponse.json({ error: error?.message ?? "Failed to create funnel" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Could not generate unique slug, please try again" }, { status: 500 });
}
