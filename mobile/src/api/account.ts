import { api } from './client';

export const accountApi = {
  /**
   * Permanently delete the signed-in account. The server anonymizes the
   * profile and revokes login; the caller must sign out locally afterward.
   */
  delete: () => api.post<{ ok: true }>('/api/account/delete'),
};
