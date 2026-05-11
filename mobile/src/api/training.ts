import { api } from './client';

export interface TrainingFile {
  name: string;
  path: string;
  url: string;
}

export interface TrainingSection {
  folder: string;
  label: string;
  files: TrainingFile[];
}

export interface TrainingDoc {
  id: string;
  title: string;
  content: string | null;
  folder: string;
  sequence_order: number;
  created_at: string;
}

export interface TrainingProgress {
  user_id: string;
  document_id: string;
  started_at: string | null;
  completed_at: string | null;
  quiz_attempts: number;
  quiz_passed: boolean;
}

export interface QuizQuestion {
  question: string;
  options: string[];
}

export const trainingApi = {
  /** Storage-bucket file browser (training docs + contracts folders). */
  sections:   () => api.get<{ data: TrainingSection[] }>('/api/training'),
  /** Per-document content + progress. */
  doc:        (id: string) => api.get<{ data: TrainingDoc; progress: TrainingProgress | null }>(`/api/training/${id}`),
  /** Quiz for a document. 404 if no quiz exists. */
  quiz:       (id: string) => api.get<{ questions: QuizQuestion[]; variant_idx: number }>(`/api/training/${id}/quiz`),
  /** Submit answers — server grades. */
  submitQuiz: (id: string, answers: number[], variantIdx: number) =>
    api.post<{ passed: boolean; score: number; correct_count: number }>(
      `/api/training/${id}/quiz`,
      { answers, variant_idx: variantIdx },
    ),
};
