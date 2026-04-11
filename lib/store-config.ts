// Store pricing config — safe to import in both client and server components

export const STORE_PRICES = {
  badge_digital:    { cents: 799,   label: "Digital Download (print-ready PDF)" },
  badge_physical_1: { cents: 1499,  label: "1 Physical Badge (mailed)" },
  badge_physical_5: { cents: 3499,  label: "5-Pack Physical Badges (mailed)" },
  badge_org_25:     { cents: 11900, label: "Org Pack — 25 Badges (mailed)" },
} as const;

export type StoreProductKey = keyof typeof STORE_PRICES;
