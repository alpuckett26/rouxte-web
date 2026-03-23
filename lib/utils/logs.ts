import { LogEventType } from "@/lib/types";

export const LOG_EVENT_LABELS: Record<LogEventType, string> = {
  // Sales / CRM
  lead_assigned: "Lead Assigned",
  lead_unassigned: "Lead Unassigned",
  status_changed: "Status Changed",
  note_added: "Note Added",
  appointment_set: "Appointment Set",
  appointment_missed: "Appointment Missed",
  appointment_completed: "Appointment Completed",
  sale_submitted: "Sale Submitted",
  sale_verified: "Sale Verified",
  sale_rejected: "Sale Rejected",
  // Compliance
  no_solicit_observed: "No Solicitation Sign Observed",
  do_not_knock_marked: "Do Not Knock Marked",
  complaint_received: "Complaint Received",
  law_enforcement_contact: "Law Enforcement Contact",
  trespass_warning: "Trespass Warning",
  // Manager
  manager_acknowledged: "Manager Acknowledged",
  manager_approved: "Manager Approved",
  manager_denied: "Manager Denied",
  coach_note_added: "Coaching Note Added",
  incident_reviewed: "Incident Reviewed",
};

export const INCIDENT_EVENT_TYPES: LogEventType[] = [
  "complaint_received",
  "law_enforcement_contact",
  "trespass_warning",
  "no_solicit_observed",
];

export const COMPLIANCE_EVENT_TYPES: LogEventType[] = [
  "no_solicit_observed",
  "do_not_knock_marked",
  "complaint_received",
  "law_enforcement_contact",
  "trespass_warning",
];

export const MANAGER_EVENT_TYPES: LogEventType[] = [
  "manager_acknowledged",
  "manager_approved",
  "manager_denied",
  "coach_note_added",
  "incident_reviewed",
];

export function isIncident(eventType: LogEventType): boolean {
  return INCIDENT_EVENT_TYPES.includes(eventType);
}

export function isManagerAction(eventType: LogEventType): boolean {
  return MANAGER_EVENT_TYPES.includes(eventType);
}
