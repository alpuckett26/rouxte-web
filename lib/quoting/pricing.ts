export type PlanType =
  | "premium"
  | "extra"
  | "starter"
  | "firstnet_unlimited"
  | "firstnet_extra"
  | "senior_55plus";

export type DiscountType = "none" | "appreciation" | "signature";

// Pricing table from AT&T Wireless Billing & Quote Worksheet
// Columns: full | autopayPaperless | appreciation | appreciationAppb | signature | signatureAppb
// signature / signatureAppb only applicable to Premium; Extra/Starter use appb columns for signature
const TABLE: Record<"premium" | "extra" | "starter", Record<number, number[]>> = {
  premium: {
    1: [95,    85,    71.25, 63.75, 85,    75   ],
    2: [85,    75,    63.75, 56.25, 75,    65   ],
    3: [70,    60,    52.50, 45,    60,    50   ],
    4: [60,    50,    45,    37.50, 50,    40   ],
    5: [55,    45,    41.25, 33.75, 45,    35   ],
    6: [50,    40,    37.50, 30,    45,    35   ],
  },
  extra: {
    1: [85,    75,    63.75, 56.25, 75,    65   ],
    2: [75,    65,    56.25, 48.75, 65,    55   ],
    3: [60,    50,    45,    37.50, 50,    40   ],
    4: [50,    40,    37.50, 30,    40,    30   ],
    5: [45,    35,    33.75, 26.25, 35,    25   ],
    6: [45,    35,    33.75, 26.25, 35,    25   ],
  },
  starter: {
    1: [75,    65,    56.25, 48.75, 65,    55   ],
    2: [70,    60,    52.50, 45,    60,    50   ],
    3: [55,    45,    41.25, 33.75, 45,    35   ],
    4: [45,    35,    33.75, 26.25, 35,    25   ],
    5: [40,    30,    30,    22.50, 30,    22.50],
    6: [40,    30,    30,    22.50, 30,    22.50],
  },
};

// col indices for standard plans
const COL = {
  full: 0,
  appb: 1,
  appreciation: 2,
  appreciationAppb: 3,
  signature: 4,
  signatureAppb: 5,
};

// FirstNet — flat per-line rates regardless of line count (verified first responders only)
// Source: firstnet.com/plans (2025)
const FIRSTNET_RATES: Record<"firstnet_unlimited" | "firstnet_extra", { base: number; autopay: number }> = {
  firstnet_unlimited: { base: 52.99, autopay: 42.99 },
  firstnet_extra:     { base: 57.99, autopay: 47.99 },
};

// 55+ Plan — flat per-line rate, minimum 2 lines required
// Source: att.com/offers/55-plus (2025)
const SENIOR_55_RATE = { base: 55, autopay: 35 };

export function getRate(
  plan: PlanType,
  totalLines: number,
  autopayPaperless: boolean,
  discount: DiscountType,
): number {
  // FirstNet: flat rate, discounts/appreciation do not apply
  if (plan === "firstnet_unlimited" || plan === "firstnet_extra") {
    return autopayPaperless
      ? FIRSTNET_RATES[plan].autopay
      : FIRSTNET_RATES[plan].base;
  }

  // 55+: flat rate, discounts/appreciation do not apply
  if (plan === "senior_55plus") {
    return autopayPaperless ? SENIOR_55_RATE.autopay : SENIOR_55_RATE.base;
  }

  // Standard plans
  const tier = Math.min(totalLines, 6);
  const row = TABLE[plan][tier];

  if (discount === "appreciation") {
    return row[autopayPaperless ? COL.appreciationAppb : COL.appreciation];
  }
  if (discount === "signature") {
    return row[autopayPaperless ? COL.signatureAppb : COL.signature];
  }
  return row[autopayPaperless ? COL.appb : COL.full];
}

export const ACTIVATION_FEE = 35; // per new/port-in line
export const NEXT_UP_FEE = 6;     // per month per line
