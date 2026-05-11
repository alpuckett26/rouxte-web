import { config } from '@/lib/config';
import { getAccessToken } from '@/lib/supabase';
import { api } from './client';

export interface AiUsage {
  used_today: number;
  daily_limit: number;
  exempt: boolean;
}

export const aiApi = {
  usage: () => api.get<AiUsage>('/api/ai/usage'),
};

/**
 * Streams AI Coach (Rex) responses from /api/ai/chat.
 * The route returns Server-Sent-Events-style text chunks.
 */
export async function streamCoach(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  mode: 'coach' | 'roleplay',
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${config.api.baseUrl}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages, mode }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI chat failed: ${res.status} ${text}`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    onChunk(text);
    return;
  }

  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) onChunk(decoder.decode(value, { stream: true }));
  }
}
