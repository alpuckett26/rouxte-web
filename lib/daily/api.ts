/**
 * Daily.co REST API helpers (server-side only).
 * Docs: https://docs.daily.co/reference
 */

const DAILY_BASE = "https://api.daily.co/v1";

function dailyHeaders() {
  const key = process.env.DAILY_API_KEY;
  if (!key) throw new Error("DAILY_API_KEY is not configured");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

export interface DailyRoom {
  id: string;
  name: string;
  url: string;
  config: Record<string, unknown>;
  created_at: number;
}

/**
 * Create a new Daily room.
 * Rooms auto-delete after `exp` (unix timestamp). Default: 4 hours from now.
 */
export async function createDailyRoom(opts: {
  name: string;
  expiresIn?: number; // seconds, default 4h
  maxParticipants?: number;
  enableRecording?: boolean;
}): Promise<DailyRoom> {
  const exp = Math.floor(Date.now() / 1000) + (opts.expiresIn ?? 4 * 60 * 60);
  const body: Record<string, unknown> = {
    name: opts.name,
    privacy: "private",
    properties: {
      exp,
      enable_screenshare: true,
      enable_chat: true,
      start_audio_off: false,
      start_video_off: false,
      max_participants: opts.maxParticipants ?? 50,
      ...(opts.enableRecording ? { enable_recording: "cloud" } : {}),
    },
  };

  const res = await fetch(`${DAILY_BASE}/rooms`, {
    method: "POST",
    headers: dailyHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Daily room creation failed: ${err}`);
  }

  return res.json();
}

export interface DailyToken {
  token: string;
}

/**
 * Create a meeting token for a specific user joining a room.
 * Tokens expire at the same time as the room.
 */
export async function createDailyToken(opts: {
  roomName: string;
  userId: string;
  userName: string;
  isOwner?: boolean;
  expiresIn?: number; // seconds, default 4h
}): Promise<DailyToken> {
  const exp = Math.floor(Date.now() / 1000) + (opts.expiresIn ?? 4 * 60 * 60);
  const body = {
    properties: {
      room_name:   opts.roomName,
      user_id:     opts.userId,
      user_name:   opts.userName,
      is_owner:    opts.isOwner ?? false,
      exp,
      enable_recording: opts.isOwner ? "cloud" : undefined,
    },
  };

  const res = await fetch(`${DAILY_BASE}/meeting-tokens`, {
    method: "POST",
    headers: dailyHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Daily token creation failed: ${err}`);
  }

  return res.json();
}

/** Delete a Daily room (called when meeting ends). */
export async function deleteDailyRoom(name: string): Promise<void> {
  await fetch(`${DAILY_BASE}/rooms/${name}`, {
    method: "DELETE",
    headers: dailyHeaders(),
  });
}
