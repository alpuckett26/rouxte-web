import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPrintfulOrder } from "@/lib/printful";
import type { PrintfulAddress } from "@/lib/printful";

// POST /api/store/webhook — Stripe webhook handler
// Must be registered in Stripe dashboard: Events: checkout.session.completed
export async function POST(request: NextRequest) {
  const sig  = request.headers.get("stripe-signature") ?? "";
  const body = await request.text();

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature invalid: ${err}` }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session  = event.data.object as { id: string; metadata: Record<string, string>; payment_intent?: string };
  const orderId  = session.metadata?.order_id;
  const productKey = session.metadata?.product_key;
  if (!orderId) return NextResponse.json({ received: true });

  const admin = createAdminClient();

  // Mark as paid
  await admin
    .from("store_orders")
    .update({
      status: "paid",
      stripe_payment_intent: session.payment_intent ?? null,
    })
    .eq("id", orderId);

  // Digital download → no fulfillment needed, just mark ready
  if (productKey === "badge_digital") {
    await admin
      .from("store_orders")
      .update({ status: "delivered" })
      .eq("id", orderId);
    return NextResponse.json({ received: true });
  }

  // Physical order → submit to Printful
  const { data: order } = await admin
    .from("store_orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (!order?.product_config) return NextResponse.json({ received: true });

  const config = order.product_config as Record<string, string>;
  const addr   = order.shipping_address as Record<string, string> | null;
  if (!addr) return NextResponse.json({ received: true });

  const quantity = productKey === "badge_org_25" ? 25 : productKey === "badge_physical_5" ? 5 : 1;
  const variantId = quantity >= 25
    ? Number(process.env.PRINTFUL_VARIANT_BADGE_25 ?? 443893)
    : quantity >= 5
      ? Number(process.env.PRINTFUL_VARIANT_BADGE_5  ?? 443892)
      : Number(process.env.PRINTFUL_VARIANT_BADGE_1  ?? 443891);

  const recipient: PrintfulAddress = {
    name:         addr.name,
    address1:     addr.address1,
    address2:     addr.address2 ?? undefined,
    city:         addr.city,
    state_code:   addr.state,
    zip:          addr.zip,
    country_code: addr.country ?? "US",
    email:        addr.email ?? undefined,
  };

  // The badge image URL — stored in product_config.print_url after digital download
  const printUrl = config.print_url ?? config.avatar_url;
  if (!printUrl) {
    console.error("No print_url in badge order config:", orderId);
    return NextResponse.json({ received: true });
  }

  try {
    const pfOrder = await createPrintfulOrder({
      external_id: orderId,
      recipient,
      items: [
        {
          variant_id: variantId,
          quantity,
          files: [{ type: "front", url: printUrl }],
        },
      ],
      confirm: true,
    });

    await admin
      .from("store_orders")
      .update({
        status:               "printing",
        fulfillment_order_id: String(pfOrder.id),
      })
      .eq("id", orderId);
  } catch (err) {
    console.error("Printful order failed:", err);
    // Don't fail the webhook — log and alert manually
  }

  return NextResponse.json({ received: true });
}
