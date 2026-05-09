// AT&T Fiber / Internet plan pricing (2025)
// Source: att.com/internet/fiber, cabletv.com (verified Apr 2026)
// All prices per month, excluding taxes and fees.

export type FiberPlanId =
  | "internet_300"
  | "internet_500"
  | "internet_1gig"
  | "internet_2gig"
  | "internet_5gig"
  | "internet_air"
  | "access";        // AT&T Access (low-income assistance program)

export interface FiberPlan {
  id: FiberPlanId;
  label: string;
  speed: string;
  basePrice: number;   // without AutoPay
  autopayPrice: number; // with AutoPay & Paperless Bill ($5 off, except Access)
  notes?: string;
}

export const FIBER_PLANS: FiberPlan[] = [
  {
    id: "internet_300",
    label: "Internet 300",
    speed: "300 Mbps",
    basePrice: 60,
    autopayPrice: 55,
  },
  {
    id: "internet_500",
    label: "Internet 500",
    speed: "500 Mbps",
    basePrice: 70,
    autopayPrice: 65,
  },
  {
    id: "internet_1gig",
    label: "Internet 1 GIG",
    speed: "1,000 Mbps",
    basePrice: 85,
    autopayPrice: 80,
  },
  {
    id: "internet_2gig",
    label: "Internet 2 GIG",
    speed: "2,000 Mbps",
    basePrice: 130,
    autopayPrice: 125,
  },
  {
    id: "internet_5gig",
    label: "Internet 5 GIG",
    speed: "5,000 Mbps",
    basePrice: 160,
    autopayPrice: 155,
  },
  {
    id: "internet_air",
    label: "Internet Air",
    speed: "90–300 Mbps (5G Fixed Wireless)",
    basePrice: 65,
    autopayPrice: 60,
    notes: "No fiber line required. Speed varies by location.",
  },
  {
    id: "access",
    label: "AT&T Access",
    speed: "Up to 100 Mbps",
    basePrice: 30,
    autopayPrice: 30, // no AutoPay discount for Access
    notes: "Income-based assistance program. Must qualify via SNAP, Medicaid, or similar.",
  },
];

// 20% off internet when customer also has an eligible AT&T wireless plan
export const WIRELESS_BUNDLE_DISCOUNT_PCT = 0.20;

export function getFiberRate(
  planId: FiberPlanId,
  autopay: boolean,
  wirelessBundle: boolean,
): number {
  const plan = FIBER_PLANS.find(p => p.id === planId);
  if (!plan) return 0;
  const base = autopay ? plan.autopayPrice : plan.basePrice;
  if (wirelessBundle && planId !== "access") {
    return parseFloat((base * (1 - WIRELESS_BUNDLE_DISCOUNT_PCT)).toFixed(2));
  }
  return base;
}

export const FIBER_ACTIVATION_FEE = 0;  // AT&T Fiber has no activation/installation fee
export const FIBER_EQUIPMENT_FEE  = 0;  // Gateway included at no extra cost
