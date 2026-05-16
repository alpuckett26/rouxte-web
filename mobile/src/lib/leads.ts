import type { LeadStatus } from '@/types';

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new:         'New',
  attempted:   'Attempted',
  interested:  'Interested',
  appointment: 'Appointment',
  sold:        'Sold',
  lost:        'Lost',
};

export type BadgeColor = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange';

export const LEAD_STATUS_COLORS: Record<LeadStatus, BadgeColor> = {
  new:         'gray',
  attempted:   'orange',
  interested:  'purple',
  appointment: 'yellow',
  sold:        'green',
  lost:        'red',
};

export const LEAD_STATUS_ORDER: LeadStatus[] = [
  'new',
  'attempted',
  'interested',
  'appointment',
  'sold',
];

export function nextStatus(current: LeadStatus): LeadStatus | null {
  const idx = LEAD_STATUS_ORDER.indexOf(current);
  if (idx === -1 || idx >= LEAD_STATUS_ORDER.length - 1) return null;
  return LEAD_STATUS_ORDER[idx + 1];
}
