export type FiberPlanId =
  | "internet_300"
  | "internet_500"
  | "internet_1gig"
  | "internet_2gig"
  | "internet_5gig"
  | "internet_air"
  | "access";

export interface FiberPlan {
  id: FiberPlanId;
  label: string;
  speed: string;
  basePrice: number;
  autopayPrice: number;
  notes?: string;
}

export const FIBER_PLANS: FiberPlan[] = [
  { id: "internet_300",  label: "Internet 300",   speed: "300 Mbps", basePrice: 60,  autopayPrice: 55  },
  { id: "internet_500",  label: "Internet 500",   speed: "500 Mbps", basePrice: 70,  autopayPrice: 65  },
  { id: "internet_1gig", label: "Internet 1 Gig", speed: "1 Gbps",   basePrice: 85,  autopayPrice: 80  },
  { id: "internet_2gig", label: "Internet 2 Gig", speed: "2 Gbps",   basePrice: 115, autopayPrice: 110 },
  { id: "internet_5gig", label: "Internet 5 Gig", speed: "5 Gbps",   basePrice: 185, autopayPrice: 180 },
  { id: "internet_air",  label: "Internet Air",   speed: "25+ Mbps", basePrice: 60,  autopayPrice: 55  },
  { id: "access",        label: "AT&T Access",    speed: "25 Mbps",  basePrice: 30,  autopayPrice: 30  },
];

export const WIRELESS_BUNDLE_DISCOUNT_PCT = 0.20;

export function getFiberRate(planId: FiberPlanId, autopay: boolean, bundle: boolean): number {
  const plan = FIBER_PLANS.find(p => p.id === planId);
  if (!plan) return 0;
  const isAccess = planId === "access";
  const base = autopay && !isAccess ? plan.autopayPrice : plan.basePrice;
  return bundle && !isAccess
    ? parseFloat((base * (1 - WIRELESS_BUNDLE_DISCOUNT_PCT)).toFixed(2))
    : base;
}
