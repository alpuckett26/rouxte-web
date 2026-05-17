"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DemoPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/demo", { method: "POST" });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setError(json.error ?? "Demo is currently unavailable.");
          return;
        }
        router.refresh();
        router.push(json.redirect ?? "/dashboard");
      } catch {
        if (!cancelled) setError("Couldn't reach the demo sign-in endpoint.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white flex items-center justify-center px-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-sm text-center max-w-sm w-full">
        <h1 className="text-lg font-semibold mb-2">Opening the demo…</h1>
        {error ? (
          <>
            <p className="text-sm text-red-400 mb-4">{error}</p>
            <a
              href="/auth"
              className="inline-block rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500"
            >
              Back to sign in
            </a>
          </>
        ) : (
          <p className="text-sm text-white/50">Signing you in as the demo admin.</p>
        )}
      </div>
    </div>
  );
}
