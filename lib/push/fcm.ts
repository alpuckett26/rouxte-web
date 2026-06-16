/**
 * Firebase Cloud Messaging (HTTP v1) sender — server only.
 *
 * Dependency-free: mints a short-lived Google OAuth2 access token by signing a
 * JWT with the service-account private key (RS256 via Node `crypto`), then
 * POSTs to the FCM v1 `messages:send` endpoint. No `googleapis`/`firebase-admin`
 * dependency is pulled in.
 *
 * Configuration (server env):
 *   FCM_SERVICE_ACCOUNT_JSON   the full service-account JSON (one line), from
 *                              Firebase Console → Project settings → Service
 *                              accounts → "Generate new private key". Must be
 *                              for project `rouxte-cd719` (matches the app's
 *                              google-services.json / GoogleService-Info.plist).
 *
 * If the env var is missing, sends are skipped silently (so local/dev without
 * FCM configured doesn't error) — the in-app notification + email still happen.
 */

import { createSign } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Arbitrary string map delivered in the data payload (all values stringified). */
  data?: Record<string, string | number | boolean | null | undefined>;
}

const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

let cachedSa: ServiceAccount | null | undefined;
let tokenCache: { token: string; expiresAt: number } | null = null;

function loadServiceAccount(): ServiceAccount | null {
  if (cachedSa !== undefined) return cachedSa;
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    cachedSa = null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
      console.error("[fcm] FCM_SERVICE_ACCOUNT_JSON is missing required fields");
      cachedSa = null;
      return null;
    }
    // Support keys stored with literal \n escapes (common in CI secrets).
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    cachedSa = parsed;
    return parsed;
  } catch (e) {
    console.error("[fcm] FCM_SERVICE_ACCOUNT_JSON is not valid JSON:", e);
    cachedSa = null;
    return null;
  }
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/** Mint (and cache) an OAuth2 access token for the FCM scope. */
async function getAccessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt > now + 60) return tokenCache.token;

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const signature = base64url(
    createSign("RSA-SHA256").update(signingInput).sign(sa.private_key),
  );
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!res.ok) {
    console.error("[fcm] token exchange failed:", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;

  tokenCache = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600),
  };
  return json.access_token;
}

/** FCM treats these as permanently dead — the token row should be deleted. */
const DEAD_TOKEN_ERRORS = new Set(["UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND"]);

/**
 * Per-user push gate. `notification_prefs` is org-scoped (user_profiles is
 * unique on user_id+org_id), so both `orgId` and `prefKey` are required to
 * resolve a preference. Mirrors the email gate's opt-out semantics: default ON,
 * suppressed only when the key is explicitly `false`.
 */
export interface PushGate {
  orgId: string;
  /** notification_prefs key, e.g. "push_lead_assigned". */
  prefKey: string;
}

/**
 * Send a push to every registered device of one user. Best-effort: failures
 * are logged, never thrown, and dead tokens are pruned from
 * `device_push_tokens`. Returns the number of devices successfully delivered.
 *
 * Pass `gate` to respect the user's `notification_prefs` opt-out for this event
 * type; omit it for transactional pushes the user can't opt out of.
 */
export async function pushToUser(
  userId: string,
  payload: PushPayload,
  gate?: PushGate,
): Promise<number> {
  const sa = loadServiceAccount();
  if (!sa) return 0; // FCM not configured — caller's in-app/email path still ran.

  const admin = createAdminClient();

  // Respect per-user opt-out before doing any send work.
  if (gate) {
    const { data: profile } = await admin
      .from("user_profiles")
      .select("notification_prefs")
      .eq("user_id", userId)
      .eq("org_id", gate.orgId)
      .maybeSingle();
    const prefs = (profile?.notification_prefs ?? {}) as Record<string, boolean>;
    if (prefs[gate.prefKey] === false) return 0; // opted out
  }

  const { data: rows } = await admin
    .from("device_push_tokens")
    .select("token")
    .eq("user_id", userId);

  const tokens = (rows ?? []).map((r) => r.token as string);
  if (tokens.length === 0) return 0;

  const accessToken = await getAccessToken(sa);
  if (!accessToken) return 0;

  // FCM data values must all be strings.
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload.data ?? {})) {
    if (v !== undefined && v !== null) data[k] = String(v);
  }

  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const deadTokens: string[] = [];
  let delivered = 0;

  await Promise.all(
    tokens.map(async (token) => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: payload.title, body: payload.body },
              data,
              android: { priority: "high" },
              apns: { payload: { aps: { sound: "default" } } },
            },
          }),
        });

        if (res.ok) {
          delivered += 1;
          return;
        }
        const err = (await res.json().catch(() => null)) as
          | { error?: { status?: string; message?: string } }
          | null;
        const status = err?.error?.status ?? "";
        if (DEAD_TOKEN_ERRORS.has(status)) deadTokens.push(token);
        else console.error("[fcm] send failed:", res.status, status, err?.error?.message);
      } catch (e) {
        console.error("[fcm] send threw:", e);
      }
    }),
  );

  if (deadTokens.length > 0) {
    await admin.from("device_push_tokens").delete().in("token", deadTokens);
  }

  return delivered;
}
