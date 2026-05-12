// AT&T Wireless plan pricing — port of lib/quoting/pricing.ts.
// Keep in sync with the web file.

export type PlanType =
  | 'premium'
  | 'extra'
  | 'starter'
  | 'firstnet_unlimited'
  | 'firstnet_extra'
  | 'senior_55plus';

export type DiscountType = 'none' | 'appreciation' | 'signature';

// Pricing TABLE from AT&T Wireless Billing & Quote Worksheet.
// Columns: full | autopayPaperless | appreciation | appreciationAppb | signature | signatureAppb
const TABLE: Record<'premium' | 'extra' | 'starter', Record<number, number[]>> = {
  premium: {
    1: [95, 85, 71.25, 63.75, 85, 75],
    2: [85, 75, 63.75, 56.25, 75, 65],
    3: [70, 60, 52.50, 45,    60, 50],
    4: [60, 50, 45,    37.50, 50, 40],
    5: [55, 45, 41.25, 33.75, 45, 35],
    6: [50, 40, 37.50, 30,    45, 35],
  },
  extra: {
    1: [85, 75, 63.75, 56.25, 75, 65],
    2: [75, 65, 56.25, 48.75, 65, 55],
    3: [60, 50, 45,    37.50, 50, 40],
    4: [50, 40, 37.50, 30,    40, 30],
    5: [45, 35, 33.75, 26.25, 35, 25],
    6: [45, 35, 33.75, 26.25, 35, 25],
  },
  starter: {
    1: [75, 65, 56.25, 48.75, 65, 55],
    2: [70, 60, 52.50, 45,    60, 50],
    3: [55, 45, 41.25, 33.75, 45, 35],
    4: [45, 35, 33.75, 26.25, 35, 25],
    5: [40, 30, 30,    22.50, 30, 22.50],
    6: [40, 30, 30,    22.50, 30, 22.50],
  },
};

const COL = {
  full:             0,
  appb:             1,
  appreciation:     2,
  appreciationAppb: 3,
  signature:        4,
  signatureAppb:    5,
};

const FIRSTNET_RATES: Record<'firstnet_unlimited' | 'firstnet_extra', { base: number; autopay: number }> = {
  firstnet_unlimited: { base: 52.99, autopay: 42.99 },
  firstnet_extra:     { base: 57.99, autopay: 47.99 },
};

const SENIOR_55_RATE = { base: 55, autopay: 35 };

export function getRate(
  plan: PlanType,
  totalLines: number,
  autopayPaperless: boolean,
  discount: DiscountType,
): number {
  if (plan === 'firstnet_unlimited' || plan === 'firstnet_extra') {
    return autopayPaperless ? FIRSTNET_RATES[plan].autopay : FIRSTNET_RATES[plan].base;
  }
  if (plan === 'senior_55plus') {
    return autopayPaperless ? SENIOR_55_RATE.autopay : SENIOR_55_RATE.base;
  }
  const tier = Math.min(Math.max(totalLines, 1), 6);
  const row = TABLE[plan][tier];
  if (discount === 'appreciation') {
    return row[autopayPaperless ? COL.appreciationAppb : COL.appreciation];
  }
  if (discount === 'signature') {
    return row[autopayPaperless ? COL.signatureAppb : COL.signature];
  }
  return row[autopayPaperless ? COL.appb : COL.full];
}

export const ACTIVATION_FEE = 35;
export const NEXT_UP_FEE = 6;

export const PLAN_LABELS: Record<PlanType, string> = {
  premium:            'Premium Unlimited',
  extra:              'Extra (50GB)',
  starter:            'Starter',
  firstnet_unlimited: 'FirstNet Unlimited',
  firstnet_extra:     'FirstNet Extra',
  senior_55plus:      '55+ Plan',
};

export const DISCOUNT_LABELS: Record<DiscountType, string> = {
  none:         'None',
  appreciation: 'Appreciation (25% off)',
  signature:    'Signature ($10/line off)',
};

export const APPRECIATION_TYPES = [
  'Military', 'First Responder', 'Retired Law Enforcement',
  'Nurse/Healthcare', 'Teacher', 'Union Member', 'Employee', 'Other',
];

export const FLAT_RATE_PLANS: PlanType[] = ['firstnet_unlimited', 'firstnet_extra', 'senior_55plus'];

export const CARRIER_GUIDE: { carrier: string; steps: string[]; tip?: string }[] = [
  {
    carrier: 'T-Mobile / Metro by T-Mobile',
    steps: [
      'Open T-Mobile app → Account → Profile → Customer Service PIN',
      'Or call 611 and ask for account number + transfer PIN',
      'Account number is on the bill or in app under Account → Profile',
    ],
    tip: 'PIN is 4–6 digits set by customer. If forgotten, reset in app.',
  },
  {
    carrier: 'Verizon',
    steps: [
      'My Verizon app → Account → Transfer your number → Generate Transfer PIN',
      'Or visit verizon.com/account/profile and generate a Transfer PIN',
      'Or call 1-800-922-0204',
    ],
    tip: 'Verizon Transfer PINs are 6 digits and expire after 7 days.',
  },
  {
    carrier: 'Cricket Wireless',
    steps: [
      'Cricket app or cricketwireless.com → My Account → Profile → Account PIN',
      'Or call 1-800-274-2538',
    ],
    tip: 'Account number is on the bill or in app under My Account.',
  },
  {
    carrier: 'Boost Mobile',
    steps: ['My Boost app → Settings → Account PIN', 'Or call 1-833-502-6678'],
  },
  {
    carrier: 'Straight Talk / TracFone / Total Wireless',
    steps: ['Visit straighttalk.com → My Account → Port Out PIN', 'Or call 1-877-430-2355'],
    tip: 'Account number is the phone number. PIN is set during account creation.',
  },
  {
    carrier: 'US Cellular',
    steps: ['My Account portal → Security → PIN', 'Or call 1-888-944-9400'],
  },
  {
    carrier: 'Xfinity Mobile',
    steps: ['Xfinity Mobile app → Account → Profile → Port-Out Info', 'Or call 1-888-936-4968'],
    tip: 'Must enable port-out in app before initiating transfer.',
  },
  {
    carrier: 'Spectrum Mobile',
    steps: ['spectrum.net → Account → Mobile → Transfer your number', 'Or call 1-833-224-6603'],
  },
  {
    carrier: 'Mint Mobile',
    steps: ['Mint app → Account → Account & Transfer PIN', 'Or call 1-800-683-7392'],
    tip: 'PIN displayed in account profile.',
  },
];
