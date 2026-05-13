// All shared types live in the web's lib/types/index.ts. Mobile re-exports them
// so we have a single source of truth and no risk of drift.
//
// Babel module-resolver (babel.config.js) + tsconfig paths map `@web/lib/types`
// to ../lib/types/index.ts.

export * from '../../../lib/types';

// Mobile-only navigation param lists. Keep these here, not in shared types.
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
};

export type OnboardingStackParamList = {
  Promo: undefined;
  Profile: undefined;
  Documents: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Leads: undefined;
  Map: undefined;
  Quotes: undefined;
  More: undefined;
};

export type LeadsStackParamList = {
  LeadsList: undefined;
  LeadDetail: { leadId: string };
  NewLead: undefined;
  LeadPull: undefined;
};

export type QuotesStackParamList = {
  QuotesList: undefined;
  NewFiberQuote: { customerId?: string; leadId?: string };
  NewWirelessQuote: { customerId?: string; leadId?: string };
  QuoteDetail: { quoteId: string };
};

export type MoreStackParamList = {
  MoreHome: undefined;
  Training: undefined;
  TrainingModule: { moduleId: string };
  TrainingQuiz: { moduleId: string };
  Coach: undefined;
  Leaderboard: undefined;
  Goals: undefined;
  SmartPitch: undefined;
  Notifications: undefined;
  Resources: undefined;
  Card: undefined;
  Store: undefined;
  Meetings: undefined;
  MeetingRoom: { id: string; title?: string };
  Manager: undefined;
  Payroll: undefined;
  Settings: undefined;
};
