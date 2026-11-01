// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "sales_manager" | "team_lead" | "sales_rep";

export type LeadStatus =
  | "new"
  | "attempted"
  | "interested"
  | "appointment"
  | "sold"
  | "lost";

export type OnboardingStep =
  | "verify"
  | "promo"
  | "profile"
  | "documents"
  | "complete";

export type PaymentMethod = "card" | "cashapp" | "paypal" | "invoice" | "company_plan";

export type LogEventType =
  // Sales / CRM
  | "door_knock"
  | "lead_assigned"
  | "lead_unassigned"
  | "lead_pulled"
  | "lead_auto_pulled"
  | "status_changed"
  | "note_added"
  | "appointment_set"
  | "appointment_missed"
  | "appointment_completed"
  | "sale_submitted"
  | "sale_verified"
  | "sale_rejected"
  | "quote_sent"
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
  lat: number | null;
  lng: number | null;
  carrier_availability: CarrierAvailability;
  status: LeadStatus;
  assigned_to: string | null;
  assigned_at: string | null;
  created_by: string;
  follow_up_at: string | null;
  appointment_at: string | null;
  installed_at: string | null;
  is_do_not_knock: boolean;
  is_opt_out: boolean;
  customer_name: string | null;
  phone: string | null;
  source: string;
  external_source: string | null;
  external_ref: string | null;
  /** Attribution token for the surface that produced the lead (migration 040). */
  source_channel: string | null;
  // Pull tracking
  pulled_at: string | null;
  pulled_by: string | null;
  cooldown_until: string | null;
  pull_reason: string | null;
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

// ─── Setter → Closer → Sale (migration 043) ───────────────────────────────────

/**
 * What job a person is doing. Deliberately separate from `UserRole`, which
 * means AUTHORITY and is wired into RLS on every table. One person can hold
 * both a setter and a closer deployment.
 */
export type SalesFunction = "setter" | "closer" | "field_rep" | "team_lead";

export type AppointmentOutcome =
  | "closed"
  | "lost"
  | "no_show"
  | "rescheduled"
  | "cancelled";

export interface RepDeployment {
  id: string;
  org_id: string;
  user_id: string;
  team_id: string | null;
  sales_function: SalesFunction;
  territory: string | null;
  program: string | null;
  is_active: boolean;
  started_at: string;
  ended_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SalesAppointment {
  id: string;
  org_id: string;
  lead_id: string;
  setter_id: string;
  /** Null = booked into the pool, not yet claimed by a closer. */
  closer_id: string | null;
  /** FK to the existing `meetings` row (the Daily room), never a copy of it. */
  meeting_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  qualification_notes: string;
  decision_maker: string | null;
  decision_maker_present: boolean | null;
  pain_points: string[];
  known_objections: string[];
  /** 1–5. Null means the setter did not rate it — which is not the same as 1. */
  estimated_fit: number | null;
  /** Null while pending. */
  outcome: AppointmentOutcome | null;
  outcome_notes: string | null;
  outcome_at: string | null;
  outcome_by: string | null;
  rescheduled_to: string | null;
  created_at: string;
  updated_at: string;
}

/** An appointment joined to the few lead/person fields a queue row needs. */
export interface AppointmentQueueItem extends SalesAppointment {
  lead: {
    id: string;
    customer_name: string | null;
    address: string;
    phone: string | null;
    status: LeadStatus;
  } | null;
  setter_name: string | null;
  closer_name: string | null;
  meeting_url: string | null;
}

export interface SaleAttribution {
  id: string;
  org_id: string;
  lead_id: string;
  appointment_id: string | null;
  log_id: string | null;
  user_id: string;
  sales_function: SalesFunction;
  /** 0 < share <= 1; the set for one sale sums to exactly 1 (DB-enforced). */
  share: number;
  share_source: "explicit" | "default_equal_split";
  created_by: string | null;
  created_at: string;
}

/**
 * `competitor_intel` (migration 012). The table predates this file and had no
 * type; the prep brief is the first consumer that needs one. `org_id` is
 * nullable because a row with no org is shared global intel.
 */
export interface CompetitorIntel {
  id: string;
  org_id: string | null;
  competitor: string;
  plan_name: string;
  monthly_price: number | null;
  download_mbps: number | null;
  upload_mbps: number | null;
  contract_required: boolean;
  /** Null = unlimited. */
  data_cap_gb: number | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/** GET /api/appointments/[id]/brief — assembled, never stored. */
export interface AppointmentBrief {
  appointment: SalesAppointment;
  lead: Lead | null;
  setter_name: string | null;
  closer_name: string | null;
  meeting_url: string | null;
  notes: LeadNote[];
  status_history: LeadStatusHistory[];
  competitor_intel: CompetitorIntel[];
  prior_appointments: SalesAppointment[];
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
