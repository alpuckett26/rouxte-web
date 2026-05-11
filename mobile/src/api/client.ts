import { config } from '@/lib/config';
import { getAccessToken } from '@/lib/supabase';

export class ApiError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: Json | FormData;
  signal?: AbortSignal;
  /** Set to true to omit Authorization header (for public endpoints). */
  unauthenticated?: boolean;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${config.api.baseUrl}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (!opts.unauthenticated) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const isFormData = opts.body instanceof FormData;
  if (opts.body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body:
      opts.body === undefined
        ? undefined
        : isFormData
        ? (opts.body as FormData)
        : JSON.stringify(opts.body),
    signal: opts.signal,
  });

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = text; }
  }

  if (!res.ok) {
    const message =
      typeof parsed === 'object' && parsed && 'error' in parsed && typeof (parsed as { error: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `${method} ${path} failed: ${res.status}`;
    throw new ApiError(res.status, parsed, message);
  }

  return parsed as T;
}

export const api = {
  get:    <T = unknown>(path: string, opts?: RequestOptions) => request<T>('GET',    path, opts),
  post:   <T = unknown>(path: string, body?: Json | FormData, opts?: Omit<RequestOptions, 'body'>) => request<T>('POST',   path, { ...opts, body }),
  patch:  <T = unknown>(path: string, body?: Json | FormData, opts?: Omit<RequestOptions, 'body'>) => request<T>('PATCH',  path, { ...opts, body }),
  put:    <T = unknown>(path: string, body?: Json | FormData, opts?: Omit<RequestOptions, 'body'>) => request<T>('PUT',    path, { ...opts, body }),
  delete: <T = unknown>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, opts),
};
