"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Mobile → web billing auth bridge.
 *
 * The mobile app is authenticated with a Supabase Bearer JWT, but the web
 * app (and the /billing page) is cookie-authenticated. When an admin taps
 * "Manage billing" in the mobile app, we open this page inside an in-app
 * WebView with the session tokens in the URL *fragment*:
 *
 *   https://rouxte.com/billing/bridge#access_token=...&refresh_token=...
 *
 * The fragment is never sent to the server (so the tokens don't hit logs or
 * middleware), but it's readable here client-side. We call setSession() —
 * which plants the Supabase cookies via the SSR browser client — then replace
 * the URL with /billing, now a fully authenticated cookie session.
 *
 * This page is listed as a public path in middleware so the unauthenticated
 * initial load isn't bounced to /auth before it can set the session.
 */
export default function BillingBridgePage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (!access_token || !refresh_token) {
      setError("Missing session tokens. Please reopen billing from the app.");
      return;
    }

    const supabase = createClient();
    supabase.auth
      .setSession({ access_token, refresh_token })
      .then((res: { error: { message: string } | null }) => {
        if (res.error) {
          setError(res.error.message);
          return;
        }
        // Strip the tokens from history and land on the real billing page.
        window.location.replace("/billing");
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Could not start session.");
      });
  }, []);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#4b5563",
      }}
    >
      {error ? (
        <div>
          <p style={{ fontWeight: 700, color: "#b91c1c", marginBottom: 8 }}>
            Couldn&apos;t open billing
          </p>
          <p style={{ fontSize: 14 }}>{error}</p>
        </div>
      ) : (
        <p>Opening billing…</p>
      )}
    </div>
  );
}
