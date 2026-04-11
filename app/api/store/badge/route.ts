import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, STORE_PRICES, StoreProductKey } from "@/lib/stripe";

// POST /api/store/badge
// Creates a Stripe Checkout Session for a badge order.
// Body: { product_key, badge_config, shipping_address? }
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id, full_name, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const body = await request.json();
  const { product_key, badge_config, shipping_address, quantity = 1 } = body as {
    product_key: StoreProductKey;
    badge_config: Record<string, unknown>;
    shipping_address?: Record<string, string>;
    quantity?: number;
  };

  if (!product_key || !STORE_PRICES[product_key]) {
    return NextResponse.json({ error: "Invalid product_key" }, { status: 400 });
  }

  const price   = STORE_PRICES[product_key];
  const isPhysical = product_key.includes("physical") || product_key.includes("org");
  const totalCents  = price.cents;

  // Create a pending order record
  const { data: order, error: orderErr } = await admin
    .from("store_orders")
    .insert({
      org_id:          profile.org_id,
      user_id:         user.id,
      product_type:    "badge",
      quantity,
      unit_price_cents: price.cents,
      total_cents:     totalCents,
      status:          "pending",
      shipping_address: isPhysical ? (shipping_address ?? null) : null,
      product_config:  badge_config,
    })
    .select("id")
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://rouxte.com";

  // Create Stripe Checkout Session
  const session = await getStripe().checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: price.cents,
          product_data: {
            name:        `Rouxte — ${price.label}`,
            description: `For: ${badge_config.full_name ?? ""}`,
            images:      [],
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      order_id:    order.id,
      user_id:     user.id,
      org_id:      profile.org_id,
      product_key,
    },
    success_url: `${origin}/store/badge/success?order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${origin}/store/badge?cancelled=1`,
    customer_email: user.email,
  });

  // Save stripe session ID
  await admin
    .from("store_orders")
    .update({ stripe_session_id: session.id })
    .eq("id", order.id);

  return NextResponse.json({ checkout_url: session.url, order_id: order.id });
}

// GET /api/store/badge — list current user's badge orders
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("store_orders")
    .select("id, product_type, quantity, total_cents, status, tracking_url, product_config, created_at")
    .eq("user_id", user.id)
    .eq("product_type", "badge")
    .order("created_at", { ascending: false });

  return NextResponse.json({ data: data ?? [] });
}
