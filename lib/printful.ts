// Printful REST API v2 helper — server-side only
// API reference: https://developers.printful.com/docs/

export interface PrintfulAddress {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state_code: string;
  zip: string;
  country_code: string;
  phone?: string;
  email?: string;
}

export interface PrintfulOrderItem {
  variant_id: number;   // Printful product variant ID
  quantity: number;
  files: Array<{
    type: "front" | "back" | "default";
    url: string;        // publicly accessible PNG/PDF URL
  }>;
}

export interface CreatePrintfulOrderInput {
  external_id: string;      // our store_order.id
  recipient: PrintfulAddress;
  items: PrintfulOrderItem[];
  confirm?: boolean;        // set true to auto-confirm (charges your Printful balance)
}

export interface PrintfulOrderResult {
  id: number;
  status: string;
  external_id: string;
}

const BASE = "https://api.printful.com";
const key  = () => process.env.PRINTFUL_API_KEY ?? "";

async function pfetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Printful ${path}: ${json?.error?.message ?? res.statusText}`);
  return json;
}

/** Create a Printful order. Returns the Printful order object. */
export async function createPrintfulOrder(
  input: CreatePrintfulOrderInput
): Promise<PrintfulOrderResult> {
  const body = await pfetch("/orders", {
    method: "POST",
    body: JSON.stringify({ ...input, confirm: input.confirm ?? false }),
  });
  return body.result as PrintfulOrderResult;
}

/** Confirm a draft Printful order (moves it to production). */
export async function confirmPrintfulOrder(printfulOrderId: number) {
  return pfetch(`/orders/${printfulOrderId}/confirm`, { method: "POST" });
}

/** Get shipping estimate before creating an order. */
export async function estimateShipping(
  recipient: PrintfulAddress,
  items: PrintfulOrderItem[]
) {
  return pfetch("/shipping/rates", {
    method: "POST",
    body: JSON.stringify({ recipient, items }),
  });
}

// ─── Product Variant IDs ───────────────────────────────────────────────────
// Business Cards (product 182) — Printful standard matte/glossy card
// These are CR80 (3.5" × 2") — identical to a badge card in a lanyard holder
// Update via: GET /products/182/variants
export const PRINTFUL_VARIANTS = {
  // quantity: variant_id
  badge_card_50:  443892, // Business Cards 50ct — configure in Printful dashboard
  badge_card_100: 443893, // 100ct
} as const;
