import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCustomerWithCard } from "@/lib/billing/square-subscriptions";
import { getTier, TRIAL_DAYS } from "@/lib/billing/tiers";

/**
 * POST /api/billing/start-trial
 *
 * Body:
 *   tier_key            'field' | 'pro'        (enterprise routes to sales contact, not this endpoint)
 *   source_id           Square Web Payments nonce from card.tokenize()
 *   verification_token? optional buyer-verification token (3DS / SCA)
 *   billing_email
 *   billing_name
 *
 * Effects:
 *   - Creates/looks-up Square Customer, saves card on file
 *   - Inserts (or updates) org_subscriptions row with status='trialing',
 *     trial_ends_at = now + TRIAL_DAYS, card_id stored for the day-31 charge
 *
 * Only admins of the org can start/manage a trial.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id, role, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.org_id) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (profile.role !== "admin") {
    return NextResponse.json(
      { error: "Only org admins can start a trial" },
      { status: 403 },
    );
  }

  let body: {
    tier_key?: string;
    source_id?: string;
    verification_token?: string;
    billing_email?: string;
    billing_name?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tier = body.tier_key ? getTier(body.tier_key) : null;
  if (!tier) {
    return NextResponse.json({ error: "Unknown tier_key" }, { status: 400 });
  }
  if (tier.key === "enterprise") {
    return NextResponse.json(
      { error: "Enterprise tier is sales-contact only" },
      { status: 400 },
    );
  }

  const sourceId = body.source_id?.trim();
  const billingEmail = body.billing_email?.trim();
  const billingName = body.billing_name?.trim() || profile.full_name?.trim();

  if (!sourceId) return NextResponse.json({ error: "Missing source_id (card nonce)" }, { status: 400 });
  if (!billingEmail) return NextResponse.json({ error: "Missing billing_email" }, { status: 400 });
  if (!billingName) return NextResponse.json({ error: "Missing billing_name" }, { status: 400 });

  // Demo mode short-circuit: skip Square entirely. The card UI on the
  // client sends source_id="demo" when NEXT_PUBLIC_BILLING_DEMO_MODE is on;
  // we also require the server-side flag so prod can't be tricked.
  const demoMode =
    process.env.BILLING_DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_BILLING_DEMO_MODE === "true";

  let card: { customerId: string; cardId: string; cardBrand?: string; cardLast4?: string };

  if (demoMode && sourceId === "demo") {
    card = {
      customerId: `demo-cust-${profile.org_id.slice(0, 8)}`,
      cardId:     `demo-card-${Date.now()}`,
      cardBrand:  "DEMO",
      cardLast4:  "0000",
    };
  } else {
    if (!process.env.SQUARE_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: "Square is not configured on the server (SQUARE_ACCESS_TOKEN missing)" },
        { status: 503 },
      );
    }
    try {
      card = await createCustomerWithCard({
        email: billingEmail,
        name: billingName,
        sourceId,
        verificationToken: body.verification_token,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save card";
      console.error("[/api/billing/start-trial] Square error:", msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  // 2. Insert (or upsert) the subscription row
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: sub, error: dbError } = await admin
    .from("org_subscriptions")
    .upsert(
      {
        org_id: profile.org_id,
        status: "trialing",
        tier_key: tier.key,
        trial_started_at: new Date().toISOString(),
        trial_ends_at: trialEndsAt,
        square_customer_id: card.customerId,
        square_card_id: card.cardId,
        billing_email: billingEmail,
        billing_name: billingName,
        created_by: user.id,
      },
      { onConflict: "org_id" },
    )
    .select()
    .single();

  if (dbError) {
    console.error("[/api/billing/start-trial] DB error:", dbError);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      ...sub,
      card_brand: card.cardBrand,
      card_last4: card.cardLast4,
    },
  });
}
