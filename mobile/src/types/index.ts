export interface UserProfile {
  user_id: string;
  org_id: string;
  full_name: string | null;
  role: 'admin' | 'sales_manager' | 'team_lead' | 'sales_rep';
  phone: string | null;
}

export interface Lead {
  id: string;
  org_id: string;
  created_by: string;
  assigned_to: string | null;
  address: string;
  customer_name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  carrier_availability: Record<string, unknown>;
}

export interface Quote {
  id: string;
  org_id: string;
  rep_id: string;
  quote_type: 'fiber' | 'wireless';
  customer_name: string | null;
  customer_email: string | null;
  monthly_total: number;
  created_at: string;
  fiber_plan: string | null;
  autopay_paperless: boolean | null;
  wireless_bundle: boolean | null;
  promo_note: string | null;
  total_lines: number | null;
  discount_type: string | null;
  activation_fee: number | null;
  quote_lines: QuoteLine[];
}

export interface QuoteLine {
  id: string;
  quote_id: string;
  line_number: number;
  plan_type: string;
  rate_plan: number;
  plan_promo: number;
  next_up: boolean;
  next_up_amt: number;
  insurance: number;
  retailer_promo: number;
  device: number;
  device_promo: number;
  line_total: number;
}

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Leads: undefined;
  Quotes: undefined;
  Activity: undefined;
};

export type LeadsStackParamList = {
  LeadsList: undefined;
  LeadDetail: { leadId: string };
  NewLead: undefined;
};

export type QuotesStackParamList = {
  QuotesList: undefined;
  NewFiberQuote: undefined;
  NewWirelessQuote: undefined;
  QuoteDetail: { quoteId: string };
};
