import { api } from './client';

export interface Meeting {
  id: string;
  org_id: string;
  created_by: string;
  title: string;
  room_name: string;
  room_url: string;
  meeting_type: 'instant' | 'scheduled';
  scheduled_at: string | null;
  status: 'waiting' | 'live' | 'ended';
  created_at: string;
  ended_at: string | null;
}

export interface MeetingJoinToken {
  token: string;
  room_url: string;
  room_name: string;
}

export const meetingsApi = {
  list:    () => api.get<{ data: { active: Meeting[]; recent: Meeting[] } }>('/api/meetings'),
  create:  (title: string, meeting_type: 'instant' | 'scheduled' = 'instant', scheduled_at?: string) =>
    api.post<{ data: Meeting }>('/api/meetings', { title, meeting_type, scheduled_at }),
  joinToken: (id: string) => api.post<MeetingJoinToken>(`/api/meetings/${id}/token`, {}),
  end:     (id: string) => api.patch<{ ok: true }>(`/api/meetings/${id}`, { status: 'ended' }),
};
