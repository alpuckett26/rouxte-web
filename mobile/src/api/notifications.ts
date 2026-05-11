import { api } from './client';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export const notificationsApi = {
  list:    () => api.get<{ notifications: Notification[]; unread: number }>('/api/notifications'),
  readAll: () => api.post<{ count: number }>('/api/notifications/read-all'),
};
