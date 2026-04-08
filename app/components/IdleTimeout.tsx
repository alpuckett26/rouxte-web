"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

const IDLE_MS     = 20 * 60 * 1000; // 20 minutes before sign-out
const WARNING_MS  = 60 * 1000;      // show warning 1 minute before sign-out
const WARN_AT_MS  = IDLE_MS - WARNING_MS;

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;

export default function IdleTimeout() {
  const [warningOpen, setWarningOpen] = useState(false);
  const [countdown, setCountdown]     = useState(60);
  const idleTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const supabase     = createClient();

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // Replace history so back button can't return to protected page
    window.location.replace("/auth");
  }, [supabase]);

  const clearTimers = useCallback(() => {
    if (idleTimer.current)    clearTimeout(idleTimer.current);
    if (warnTimer.current)    clearTimeout(warnTimer.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const startTimers = useCallback(() => {
    clearTimers();
    setWarningOpen(false);

    warnTimer.current = setTimeout(() => {
      setWarningOpen(true);
      setCountdown(60);
      countdownRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(countdownRef.current!);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }, WARN_AT_MS);

    idleTimer.current = setTimeout(() => {
      signOut();
    }, IDLE_MS);
  }, [clearTimers, signOut]);

  // Reset timers on any user activity
  const onActivity = useCallback(() => {
    if (warningOpen) return; // let the warning run its course
    startTimers();
  }, [warningOpen, startTimers]);

  useEffect(() => {
    startTimers();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    // Catch bfcache restoration — browser shows cached page after back navigation
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        // Page was restored from bfcache after logout — force reload so middleware fires
        supabase.auth.getUser().then(({ data }: { data: { user: unknown } }) => {
          if (!data.user) window.location.replace("/auth");
        });
      }
    };
    window.addEventListener("pageshow", onPageShow);

    return () => {
      clearTimers();
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [startTimers, onActivity, clearTimers, supabase]);

  if (!warningOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 mx-4 w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mb-1">Still there?</h2>
        <p className="text-sm text-gray-500 mb-4">
          You'll be signed out due to inactivity in{" "}
          <span className="font-semibold text-gray-800">{countdown}s</span>.
        </p>

        <div className="flex gap-3">
          <button
            onClick={signOut}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Sign out
          </button>
          <button
            onClick={startTimers}
            className="flex-1 rounded-xl bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
