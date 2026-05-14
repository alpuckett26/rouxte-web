import { NextResponse } from "next/server";
import { TIERS, TRIAL_DAYS, formatPriceLabel } from "@/lib/billing/tiers";

/**
 * GET /api/billing/tiers
 * Public. Returns the canonical tier list for the PricingModal,
 * /pricing page, and any marketing surfaces.
 */
export async function GET() {
  return NextResponse.json({
    trial_days: TRIAL_DAYS,
    tiers: TIERS.map((t) => ({
      ...t,
      price_label: formatPriceLabel(t),
    })),
  });
}
