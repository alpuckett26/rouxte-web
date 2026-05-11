import { api } from './client';

export interface Notification {
  id: string;
  user_id: string;
  org_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export const notificationsApi = {
  list:    () => api.get<{ notifications: Notification[]; unread_count: number }>('/api/notifications'),
  readAll: () => api.post<{ count: number }>('/api/notifications/read-all'),
};
