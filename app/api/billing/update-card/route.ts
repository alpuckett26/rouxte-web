import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCustomerWithCard } from "@/lib/billing/square-subscriptions";

/**
 * POST /api/billing/update-card
 * Replaces the card on file. New card token (source_id) comes from
 * the Square Web Payments SDK. Reuses the same customer record;
 * the old card_id is overwritten on the subscription row.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("user_profiles").select("org_id, role, full_name")
    .eq("user_id", user.id).maybeSingle();
  if (!profile?.org_id) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Only admins can update billing" }, { status: 403 });
  }

  let body: { source_id?: string; verification_token?: string; billing_email?: string; billing_name?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const sourceId = body.source_id?.trim();
  if (!sourceId) return NextResponse.json({ error: "Missing source_id" }, { status: 400 });

  const { data: sub } = await admin
    .from("org_subscriptions").select("*").eq("org_id", profile.org_id).maybeSingle();
  if (!sub) return NextResponse.json({ error: "No active subscription" }, { status: 404 });

  const email = body.billing_email?.trim() || sub.billing_email || "";
  const name  = body.billing_name?.trim()  || sub.billing_name  || profile.full_name || "Owner";

  const demoMode =
    process.env.BILLING_DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_BILLING_DEMO_MODE === "true";

  let card: { customerId: string; cardId: string; cardBrand?: string; cardLast4?: string };
  if (demoMode && sourceId === "demo") {
    card = {
      customerId: sub.square_customer_id ?? `demo-cust-${profile.org_id.slice(0, 8)}`,
      cardId:     `demo-card-${Date.now()}`,
      cardBrand:  "DEMO",
      cardLast4:  "0000",
    };
  } else {
    try {
      card = await createCustomerWithCard({
        email, name, sourceId,
        verificationToken: body.verification_token,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save card";
      console.error("[/api/billing/update-card] Square error:", msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  const { error } = await admin
    .from("org_subscriptions")
    .update({
      square_customer_id: card.customerId,
      square_card_id:     card.cardId,
      billing_email:      email || sub.billing_email,
      billing_name:       name  || sub.billing_name,
    })
    .eq("org_id", profile.org_id);

  if (error) {
    console.error("[/api/billing/update-card] DB error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    card_brand: card.cardBrand,
    card_last4: card.cardLast4,
  });
}
