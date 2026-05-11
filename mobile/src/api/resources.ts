import { api } from './client';

export interface OrgDocument {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  uploaded_by: string;
  url: string | null;
}

export const resourcesApi = {
  list: () => api.get<{ documents: OrgDocument[] }>('/api/manager/documents'),
};
