import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPrintfulOrder } from "@/lib/printful";
import type { PrintfulAddress } from "@/lib/printful";

// POST /api/store/webhook — Square webhook handler
// Register in Square Developer Dashboard → Webhooks
// Events to subscribe: payment.completed, order.fulfillment.updated

function verifySquareSignature(
  body: string,
  signature: string,
  notificationUrl: string
): boolean {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "";
  const hmac = createHmac("sha256", key)
    .update(notificationUrl + body)
    .digest("base64");
  return hmac === signature;
}

export async function POST(request: NextRequest) {
  const body      = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature") ?? "";
  const notifUrl  = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://rouxte.com"}/api/store/webhook`;

  if (process.env.SQUARE_WEBHOOK_SIGNATURE_KEY && !verifySquareSignature(body, signature, notifUrl)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(body) as {
    type: string;
    data?: {
      object?: {
        payment?: { order_id?: string; status?: string };
        order?: { reference_id?: string; state?: string };
      };
    };
  };

  const admin = createAdminClient();

  // ── payment.completed ────────────────────────────────────────────────────
  if (event.type === "payment.completed") {
    const orderId = event.data?.object?.payment?.order_id;
    if (!orderId) return NextResponse.json({ received: true });

    // Square order_id ≠ our DB order ID — look up via reference_id stored on order
    // reference_id was set to our DB order.id when creating the payment link
    const { data: orders } = await admin
      .from("store_orders")
      .select("*")
      .eq("stripe_session_id", orderId) // we stored Square payment link id here
      .limit(1);

    const order = orders?.[0];
    if (!order) return NextResponse.json({ received: true });

    await admin
      .from("store_orders")
      .update({ status: "paid" })
      .eq("id", order.id);

    const productKey = order.product_config?.product_key as string | undefined;

    // Digital download → instantly delivered
    if (!productKey || productKey === "badge_digital") {
      await admin
        .from("store_orders")
        .update({ status: "delivered" })
        .eq("id", order.id);
      return NextResponse.json({ received: true });
    }

    // Physical → submit to Printful
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

    const printUrl = config.print_url ?? config.avatar_url;
    if (!printUrl) return NextResponse.json({ received: true });

    try {
      const pfOrder = await createPrintfulOrder({
        external_id: order.id,
        recipient,
        items: [{ variant_id: variantId, quantity, files: [{ type: "front", url: printUrl }] }],
        confirm: true,
      });
      await admin
        .from("store_orders")
        .update({ status: "printing", fulfillment_order_id: String(pfOrder.id) })
        .eq("id", order.id);
    } catch (err) {
      console.error("Printful order failed:", err);
    }
  }

  return NextResponse.json({ received: true });
}
