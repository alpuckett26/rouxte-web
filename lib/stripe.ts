import Stripe from "stripe";

// Server-side only — do NOT import this in client components.
// For shared price config use lib/store-config.ts instead.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
  typescript: true,
});

export type { StoreProductKey } from "./store-config";
export { STORE_PRICES } from "./store-config";
