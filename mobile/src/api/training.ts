import { api } from './client';

// ── Documents (storage browser — separate from interactive training) ──────
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

// ── Interactive training modules (training_documents table) ───────────────
export interface TrainingProgress {
  started_at: string | null;
  completed_at: string | null;
  quiz_passed: boolean;
  quiz_attempts: number;
}

export interface TrainingModuleSummary {
  id: string;
  title: string;
  folder: string;
  sequence_order: number | null;
  content_length: number;
  progress: TrainingProgress | null;
}

export interface ModuleListResponse {
  data: TrainingModuleSummary[];
  completed: number;
  total: number;
}

export interface TrainingDoc {
  id: string;
  title: string;
  content: string | null;
  folder: string;
  sequence_order: number | null;
}

export interface QuizQuestion {
  question: string;
  options: string[];
}

export interface QuizResponse {
  questions: QuizQuestion[];
  variant: number;
}

export interface GradedQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  user_answer: number;
  is_correct: boolean;
}

export interface QuizResult {
  correct: number;
  total: number;
  passed: boolean;
  attempts: number;
  pass_threshold: number;
  graded: GradedQuestion[];
}

export const trainingApi = {
  /** Storage-bucket file browser (training docs + contracts folders). */
  sections:   () => api.get<{ data: TrainingSection[] }>('/api/training'),
  /** Interactive module list with progress. This is the "Training" experience. */
  progress:   () => api.get<ModuleListResponse>('/api/training/progress'),
  /** Per-document content. */
  doc:        (id: string) => api.get<{ data: TrainingDoc; progress: TrainingProgress | null }>(`/api/training/${id}`),
  /** Quiz for a document. 404 if no quiz exists yet. */
  quiz:       (id: string) => api.get<QuizResponse>(`/api/training/${id}/quiz`),
  /** Submit answers — server grades. */
  submitQuiz: (id: string, answers: number[], variant: number) =>
    api.post<QuizResult>(`/api/training/${id}/quiz`, { answers, variant }),
};
