export type PlanType = "premium" | "extra" | "starter";
export type DiscountType = "none" | "appreciation" | "signature";

// Pricing table from AT&T Wireless Billing & Quote Worksheet
// Columns: full | autopayPaperless | appreciation | appreciationAppb | signature | signatureAppb
// signature / signatureAppb only applicable to Premium; Extra/Starter use appb columns for signature
const TABLE: Record<PlanType, Record<number, number[]>> = {
  premium: {
    1:  [95,    85,    71.25, 63.75, 85,    75   ],
    2:  [85,    75,    63.75, 56.25, 75,    65   ],
    3:  [70,    60,    52.50, 45,    60,    50   ],
    4:  [60,    50,    45,    37.50, 50,    40   ],
    5:  [55,    45,    41.25, 33.75, 45,    35   ],
    6:  [50,    40,    37.50, 30,    45,    35   ],
  },
  extra: {
    1:  [85,    75,    63.75, 56.25, 75,    65   ],
    2:  [75,    65,    56.25, 48.75, 65,    55   ],
    3:  [60,    50,    45,    37.50, 50,    40   ],
    4:  [50,    40,    37.50, 30,    40,    30   ],
    5:  [45,    35,    33.75, 26.25, 35,    25   ],
    6:  [45,    35,    33.75, 26.25, 35,    25   ],
  },
  starter: {
    1:  [75,    65,    56.25, 48.75, 65,    55   ],
    2:  [70,    60,    52.50, 45,    60,    50   ],
    3:  [55,    45,    41.25, 33.75, 45,    35   ],
    4:  [45,    35,    33.75, 26.25, 35,    25   ],
    5:  [40,    30,    30,    22.50, 30,    22.50],
    6:  [40,    30,    30,    22.50, 30,    22.50],
  },
};

// col indices
const COL = {
  full: 0,
  appb: 1,
  appreciation: 2,
  appreciationAppb: 3,
  signature: 4,
  signatureAppb: 5,
};

export function getRate(
  plan: PlanType,
  totalLines: number,
  autopayPaperless: boolean,
  discount: DiscountType,
): number {
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
