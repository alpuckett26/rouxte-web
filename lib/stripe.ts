import Stripe from "stripe";

// Server-side only — do NOT import this in client components.
// For shared price config use lib/store-config.ts instead.

let _stripe: Stripe | null = null;

/** Lazily initialized — safe at build time when env vars aren't present. */
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-03-25.dahlia",
      typescript: true,
    });
  }
  return _stripe;
}

export type { StoreProductKey } from "./store-config";
export { STORE_PRICES } from "./store-config";
