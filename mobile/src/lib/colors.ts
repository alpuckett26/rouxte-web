// Design tokens — mirror the web's Tailwind palette so the apps look identical.
// Web reference: app/components/ui, AppShell.tsx.

export const colors = {
  // Backgrounds
  bg:        '#0a0f1e',
  bgElev:    '#0f172a',
  bgCard:    '#111827',
  bgInput:   '#0f172a',

  // Borders
  border:    '#1e293b',
  borderHi:  '#334155',

  // Text
  text:      '#f1f5f9',
  textDim:   '#94a3b8',
  textMute:  '#64748b',

  // Brand
  brand:     '#1BAEE1',
  brandHi:   '#3bc4f0',
  brandLo:   '#1898c2',

  // Status / semantic
  success:   '#22c55e',
  warning:   '#eab308',
  danger:    '#ef4444',
  info:      '#3b82f6',
} as const;

// Lead status palette — mirrors STATUS_HEX in app/components/map/MapboxMap.tsx.
// Keep in sync with that file.
export const STATUS_HEX: Record<string, string> = {
  new:         '#94a3b8',
  attempted:   '#f97316',
  interested:  '#a855f7',
  appointment: '#eab308',
  sold:        '#22c55e',
  lost:        '#ef4444',
};
