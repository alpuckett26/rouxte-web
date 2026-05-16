import { LeadStatus } from "@/lib/types";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new:         "New",
  attempted:   "Attempted",
  interested:  "Interested",
  appointment: "Appointment",
  sold:        "Sold",
  lost:        "Lost",
};

export const LEAD_STATUS_COLORS: Record<
  LeadStatus,
  "gray" | "blue" | "green" | "yellow" | "red" | "purple" | "orange"
> = {
  new:         "gray",
  attempted:   "orange",
  interested:  "purple",
  appointment: "yellow",
  sold:        "green",
  lost:        "red",
};

/** Forward progression. `lost` is terminal (off the path). */
export const LEAD_STATUS_ORDER: LeadStatus[] = [
  "new",
  "attempted",
  "interested",
  "appointment",
  "sold",
];

export function nextStatus(current: LeadStatus): LeadStatus | null {
  const idx = LEAD_STATUS_ORDER.indexOf(current);
  if (idx === -1 || idx >= LEAD_STATUS_ORDER.length - 1) return null;
  return LEAD_STATUS_ORDER[idx + 1];
}

/** True if `target` would be moving the lead backwards in the funnel. */
export function isBackwardsTransition(current: LeadStatus, target: LeadStatus): boolean {
  if (current === target) return false;
  if (target === "lost") return false; // marking lost is allowed from anywhere
  const a = LEAD_STATUS_ORDER.indexOf(current);
  const b = LEAD_STATUS_ORDER.indexOf(target);
  if (a === -1 || b === -1) return false;
  return b < a;
}
