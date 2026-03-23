import { LeadStatus } from "@/lib/types";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  attempted: "Attempted",
  contacted: "Contacted",
  qualified: "Qualified",
  appointment_set: "Appt Set",
  sold: "Sold",
  installed: "Installed",
  closed_lost: "Closed / Lost",
};

export const LEAD_STATUS_COLORS: Record<
  LeadStatus,
  "gray" | "blue" | "green" | "yellow" | "red" | "purple" | "orange"
> = {
  new: "gray",
  attempted: "orange",
  contacted: "blue",
  qualified: "purple",
  appointment_set: "yellow",
  sold: "green",
  installed: "green",
  closed_lost: "red",
};

export const LEAD_STATUS_ORDER: LeadStatus[] = [
  "new",
  "attempted",
  "contacted",
  "qualified",
  "appointment_set",
  "sold",
  "installed",
  "closed_lost",
];

export function nextStatus(current: LeadStatus): LeadStatus | null {
  const idx = LEAD_STATUS_ORDER.indexOf(current);
  if (idx === -1 || idx >= LEAD_STATUS_ORDER.length - 2) return null;
  return LEAD_STATUS_ORDER[idx + 1];
}
