import { api } from './client';

export interface TrainingModule {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  content_md: string | null;
  order_index: number;
  required: boolean;
  created_at: string;
}

export interface TrainingProgress {
  module_id: string;
  user_id: string;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  quiz_attempts: number;
  best_score: number | null;
  completed_at: string | null;
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correct_index?: number; // hidden in payload, returned only after submission
}

export const trainingApi = {
  list:        () => api.get<{ modules: TrainingModule[]; progress: TrainingProgress[] }>('/api/training'),
  get:         (id: string) => api.get<{ module: TrainingModule; progress: TrainingProgress | null }>(`/api/training/${id}`),
  quiz:        (id: string) => api.get<{ questions: QuizQuestion[]; variant_id: string }>(`/api/training/${id}/quiz`),
  submitQuiz:  (id: string, answers: number[], variantId: string) =>
    api.post<{ passed: boolean; score: number; correct_count: number }>(
      `/api/training/${id}/quiz`,
      { answers, variant_id: variantId },
    ),
  setProgress: (moduleId: string, status: TrainingProgress['status']) =>
    api.post<{ ok: true }>('/api/training/progress', { module_id: moduleId, status }),
};
