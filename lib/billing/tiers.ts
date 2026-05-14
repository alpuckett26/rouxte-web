/**
 * Pricing tier definitions — single source of truth.
 * Used by:
 *   - PricingModal + /pricing public page (UI)
 *   - /api/billing/tiers (returned to client)
 *   - /api/billing/start-trial (validates tier_key, sets monthly_price_cents)
 *
 * All prices are per-rep per-month, USD cents.
 */

export const TRIAL_DAYS = 30;

export type TierKey = "field" | "pro" | "enterprise";

export interface Tier {
  key: TierKey;
  name: string;
  /** Per-rep monthly price in USD cents. null = contact-sales tier. */
  monthly_price_cents: number | null;
  /** Short tagline shown under the tier name. */
  tagline: string;
  /** Marketing copy shown above the feature list. */
  description: string;
  /** Feature bullets. */
  features: string[];
  /** Highlight tier with a "Most Popular" badge in UI. */
  popular?: boolean;
  /** CTA label. */
  cta: string;
  /** Whether selecting this tier requires card collection. */
  requires_card: boolean;
}

export const TIERS: readonly Tier[] = [
  {
    key: "field",
    name: "Field",
    monthly_price_cents: 999, // $9.99
    tagline: "For solo reps and small crews getting started",
    description:
      "Everything a rep needs to knock doors, capture leads, and log sales — without a back office.",
    features: [
      "Lead capture, map, and bulk Select Area",
      "Mobile app with Field Mode (offline queue)",
      "AI Coach (Rex) — 50 prompts/day per rep",
      "SmartPitch lead-capture funnel per rep",
      "Sales activity logger",
      "1 manager seat included",
    ],
    cta: "Start free 30-day trial",
    requires_card: true,
  },
  {
    key: "pro",
    name: "Pro",
    monthly_price_cents: 1999, // $19.99
    tagline: "For dealerships running a real org",
    description:
      "Everything in Field, plus the manager tools, quoting, payroll, training, and in-app meetings your team actually runs on.",
    features: [
      "Everything in Field",
      "Unlimited AI Coach prompts",
      "Quote builder — fiber + wireless (PDF + email)",
      "Manager queue + sale sign-off",
      "Payroll management + commission overrides",
      "In-app video meetings (Daily.co)",
      "Training modules + quizzes",
      "FCC AT&T coverage data on the map",
      "Up to 5 manager seats",
    ],
    popular: true,
    cta: "Start free 30-day trial",
    requires_card: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    monthly_price_cents: null,
    tagline: "For master dealers and large multi-org operations",
    description:
      "Built for master dealers like RS&I — white-label, multi-org control, dedicated support, and revenue share on every sub-dealer you bring on.",
    features: [
      "Everything in Pro",
      "White-label / custom branding",
      "Master dealer rev-share program",
      "Multi-org admin console",
      "API access",
      "Dedicated customer success manager",
      "Custom training content",
      "SLA + priority support",
    ],
    cta: "Talk to sales",
    requires_card: false,
  },
] as const;

export function getTier(key: string): Tier | null {
  return TIERS.find((t) => t.key === key) ?? null;
}

export function formatPrice(cents: number | null): string {
  if (cents === null) return "Custom";
  const dollars = cents / 100;
  return dollars.toFixed(2).endsWith(".00")
    ? `$${dollars.toFixed(0)}`
    : `$${dollars.toFixed(2)}`;
}

export function formatPriceLabel(tier: Tier): string {
  if (tier.monthly_price_cents === null) return "Contact us";
  return `${formatPrice(tier.monthly_price_cents)}/rep/mo`;
}
