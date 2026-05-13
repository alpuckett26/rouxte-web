import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { api, ApiError } from '@/api/client';

/** A single queued write that survives offline / app restart. */
interface QueuedMutation {
  id:        string;
  method:    'POST' | 'PATCH' | 'DELETE';
  path:      string;
  body:      unknown;
  createdAt: number;
  attempts:  number;
}

const STORAGE_KEY = 'mutations.pending';
const MAX_ATTEMPTS = 5;
const BACKOFF_MS = [0, 1_000, 4_000, 15_000, 60_000];

type ChangeListener = (count: number) => void;

class OfflineQueue {
  private queue: QueuedMutation[] = [];
  private loaded = false;
  private draining = false;
  private listeners: Set<ChangeListener> = new Set();
  private online = true;

  /** Load persisted queue + subscribe to NetInfo. Idempotent. */
  async init(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;

    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as QueuedMutation[];
        if (Array.isArray(parsed)) this.queue = parsed;
      }
    } catch { /* corrupt → start fresh */ }
    this.notify();

    NetInfo.addEventListener((state) => {
      const wasOnline = this.online;
      this.online = !!state.isConnected;
      if (!wasOnline && this.online && this.queue.length > 0) {
        // Just came back online — drain
        void this.drain();
      }
    });
  }

  /** True if NetInfo currently reports a connection. */
  isOnline(): boolean { return this.online; }

  size(): number { return this.queue.length; }

  /**
   * Push a mutation to the queue and persist. Use when you've already
   * decided the call must run offline. For online → fall back to api.* directly.
   */
  async enqueue(m: Omit<QueuedMutation, 'id' | 'createdAt' | 'attempts'>): Promise<void> {
    const entry: QueuedMutation = {
      id:        randomId(),
      createdAt: Date.now(),
      attempts:  0,
      ...m,
    };
    this.queue.push(entry);
    await this.persist();
    this.notify();

    // If we're already online when this was enqueued (rare race), kick the drain
    if (this.online) void this.drain();
  }

  /**
   * Drain pending mutations one-by-one, removing on 2xx, retrying on
   * network errors up to MAX_ATTEMPTS with exponential backoff, dropping
   * on 4xx (server rejected — retry won't help).
   */
  async drain(): Promise<void> {
    if (this.draining || !this.online) return;
    this.draining = true;

    try {
      while (this.queue.length > 0 && this.online) {
        const m = this.queue[0];
        m.attempts += 1;

        try {
          const path = m.path;
          if (m.method === 'POST')        await api.post(path, m.body as never);
          else if (m.method === 'PATCH')  await api.patch(path, m.body as never);
          else                            await api.delete(path);
          // Success — pop
          this.queue.shift();
          await this.persist();
          this.notify();
        } catch (err) {
          if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
            // 4xx — server rejected; retrying won't help. Drop.
            console.warn(`[offlineQueue] dropping ${m.method} ${m.path} after 4xx:`, err.message);
            this.queue.shift();
            await this.persist();
            this.notify();
            continue;
          }
          if (m.attempts >= MAX_ATTEMPTS) {
            console.warn(`[offlineQueue] dropping ${m.method} ${m.path} after ${MAX_ATTEMPTS} attempts`);
            this.queue.shift();
            await this.persist();
            this.notify();
            continue;
          }
          // Network or 5xx — back off and stop draining; NetInfo or a
          // future enqueue will retrigger.
          await this.persist(); // save the bumped attempts counter
          await new Promise((r) => setTimeout(r, BACKOFF_MS[Math.min(m.attempts, BACKOFF_MS.length - 1)]));
          break;
        }
      }
    } finally {
      this.draining = false;
    }
  }

  /** Subscribe to size changes — drives the SyncBadge UI. */
  onChange(cb: ChangeListener): () => void {
    this.listeners.add(cb);
    cb(this.queue.length); // emit current
    return () => { this.listeners.delete(cb); };
  }

  private notify() {
    for (const l of this.listeners) l(this.queue.length);
  }

  private async persist() {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch { /* full disk etc — best effort */ }
  }
}

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const offlineQueue = new OfflineQueue();
