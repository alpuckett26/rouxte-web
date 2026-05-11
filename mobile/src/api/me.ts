import { api } from './client';
import type { UserRole } from '@/types';

export interface MeResponse {
  user_id:    string;
  email:      string | null;
  role:       UserRole;
  full_name:  string | null;
  org_id:     string | null;
  team_id:    string | null;
  avatar_url: string | null;
  org_name:   string | null;
}

export const meApi = {
  get:        () => api.get<MeResponse>('/api/me'),
  updatePhone: (phone: string) => api.patch<{ ok: true }>('/api/me/phone', { phone }),
};
