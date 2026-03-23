// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "sales_manager" | "team_lead" | "sales_rep";

export type LeadStatus =
  | "new"
  | "attempted"
  | "contacted"
  | "qualified"
  | "appointment_set"
  | "sold"
  | "installed"
  | "closed_lost";

export type OnboardingStep =
  | "verify"
  | "promo"
  | "profile"
  | "complete";

export type PaymentMethod = "card" | "cashapp" | "paypal" | "invoice" | "company_plan";

export type LogEventType =
  // Sales / CRM
  | "lead_assigned"
  | "lead_unassigned"
  | "status_changed"
  | "note_added"
  | "appointment_set"
  | "appointment_missed"
  | "appointment_completed"
  | "sale_submitted"
  | "sale_verified"
  | "sale_rejected"
  // Compliance
  | "no_solicit_observed"
  | "do_not_knock_marked"
  | "complaint_received"
  | "law_enforcement_contact"
  | "trespass_warning"
  // Manager
  | "manager_acknowledged"
  | "manager_approved"
  | "manager_denied"
  | "coach_note_added"
  | "incident_reviewed";

export type SignoffAction = "acknowledged" | "approved" | "denied";

// ─── Core Entities ─────────────────────────────────────────────────────────────

export interface Org {
  id: string;
  name: string;
  created_at: string;
}

export interface Team {
  id: string;
  org_id: string;
  name: string;
  tier: number;
  benefits: Record<string, unknown>;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: UserRole;
  joined_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  org_id: string;
  team_id: string | null;
  role: UserRole;
  full_name: string;
  territory: string | null;
  carrier_focus: string | null;
  notification_prefs: Record<string, boolean>;
  onboarding_step: OnboardingStep;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Leads ─────────────────────────────────────────────────────────────────────

export interface Lead {
  id: string;
  org_id: string;
  address: string;
  lat: number;
  lng: number;
  carrier_availability: CarrierAvailability;
  status: LeadStatus;
  assigned_to: string | null;
  created_by: string;
  follow_up_at: string | null;
  appointment_at: string | null;
  is_do_not_knock: boolean;
  is_opt_out: boolean;
  created_at: string;
  updated_at: string;
}

export interface CarrierAvailability {
  att: boolean;
  competitors: string[];
  max_down_mbps: number | null;
  max_up_mbps: number | null;
  tech_codes: string[];
  fcc_block_id: string | null;
}

export interface LeadStatusHistory {
  id: string;
  lead_id: string;
  from_status: LeadStatus | null;
  to_status: LeadStatus;
  changed_by: string;
  ts: string;
}

export interface Tag {
  id: string;
  org_id: string;
  name: string;
  color: string;
}

export interface LeadTag {
  id: string;
  lead_id: string;
  tag_id: string;
  assigned_by: string;
  ts: string;
  tag?: Tag;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  author_id: string;
  body: string;
  ts: string;
  author?: UserProfile;
}

// ─── Compliance ────────────────────────────────────────────────────────────────

export interface OptOutAddress {
  id: string;
  org_id: string;
  normalized_address: string;
  lead_id: string | null;
  source: "qr" | "manual";
  ts: string;
  created_by: string | null;
}

export interface QRCode {
  id: string;
  org_id: string;
  code: string;
  campaign: string | null;
  created_at: string;
}

// ─── AI ────────────────────────────────────────────────────────────────────────

export interface AIUsage {
  id: string;
  org_id: string;
  user_id: string;
  date: string;
  prompts_used: number;
  total_prompts_used: number;
}

export interface TeamTier {
  id: string;
  org_id: string;
  team_id: string;
  tier: number;
  benefits: Record<string, unknown>;
  member_count: number;
}

export interface AIPromptLog {
  id: string;
  org_id: string;
  user_id: string;
  lead_id: string | null;
  prompt_type: string;
  tokens: number;
  ts: string;
}

// ─── Sales Logger ──────────────────────────────────────────────────────────────

export interface SalesActivityLog {
  id: string;
  org_id: string;
  lead_id: string | null;
  actor_id: string;
  team_id: string | null;
  event_type: LogEventType;
  summary: string;
  metadata: Record<string, unknown>;
  amends_log_id: string | null;
  is_incident: boolean;
  ts: string;
  actor?: UserProfile;
  attachments?: SalesActivityAttachment[];
  signoffs?: SalesActivitySignoff[];
}

export interface SalesActivityAttachment {
  id: string;
  log_id: string;
  org_id: string;
  file_url: string;
  file_type: string;
  label: string | null;
  uploaded_by: string;
  ts: string;
}

export interface SalesActivitySignoff {
  id: string;
  log_id: string;
  org_id: string;
  manager_id: string;
  action: SignoffAction;
  note: string | null;
  ts: string;
  manager?: UserProfile;
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export interface PaymentRecord {
  id: string;
  org_id: string;
  user_id: string;
  method: PaymentMethod;
  amount_cents: number;
  currency: string;
  status: "pending" | "succeeded" | "failed";
  receipt_url: string | null;
  created_at: string;
}

// ─── Dashboard / Analytics ─────────────────────────────────────────────────────

export interface RepStats {
  user_id: string;
  full_name: string;
  doors_knocked: number;
  contacts: number;
  appointments: number;
  sales: number;
  conversion_pct: number;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface LeadFilters {
  carrier?: "att" | "other";
  status?: LeadStatus;
  tags?: string[];
  assigned_to?: string;
  is_do_not_knock?: boolean;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}

export interface LogFilters {
  lead_id?: string;
  team_id?: string;
  user_id?: string;
  event_type?: LogEventType;
  incidents_only?: boolean;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}
