"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/onboarding/check";
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: callbackUrl },
        });
        if (err) throw err;
        router.push("/auth/verify");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        router.push(next);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "github") {
    setOauthLoading(provider);
    setError("");
    const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl },
    });
    if (err) {
      setError(err.message);
      setOauthLoading(null);
    }
  }

  async function handleDemo() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/demo", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Demo unavailable");
      router.refresh();
      router.push(json.redirect ?? "/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Demo sign-in failed.");
      setLoading(false);
    }
  }

  const demoEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO === "true";

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white flex items-center justify-center px-4 overflow-hidden">

      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-blue-600 opacity-[0.10] blur-[100px]" />
        <div className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-indigo-500 opacity-[0.08] blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm">

        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <Link href="/">
            <img src="/logo.svg" alt="Rouxte" className="h-14 mb-6" />
          </Link>
          <h1 className="text-xl font-semibold text-white">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-white/50">
            {mode === "login" ? "Sign in to your team" : "Join your sales team"}
          </p>
        </div>

        {/* OAuth buttons */}
        <div className="flex flex-col gap-2.5 mb-5">
          <button
            onClick={() => handleOAuth("google")}
            disabled={!!oauthLoading}
            className="flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-50 transition-colors"
          >
            {oauthLoading === "google" ? (
              <Spinner />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </button>

          <button
            onClick={() => handleOAuth("github")}
            disabled={!!oauthLoading}
            className="flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-50 transition-colors"
          >
            {oauthLoading === "github" ? (
              <Spinner />
            ) : (
              <GitHubIcon />
            )}
            Continue with GitHub
          </button>

          {demoEnabled && (
            <button
              onClick={handleDemo}
              disabled={loading || !!oauthLoading}
              className="mt-1 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-sm font-medium text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-50 transition-colors"
            >
              {loading ? <Spinner /> : null}
              Try the demo
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-white/30">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Email/password card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-white/60">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-white/60">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
              />
            </div>

            {error && (
              <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 disabled:opacity-60 transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner />
                  {mode === "login" ? "Signing in…" : "Creating account…"}
                </span>
              ) : (
                mode === "login" ? "Sign in" : "Create account"
              )}
            </button>
          </form>
        </div>

        {/* Toggle */}
        <p className="mt-5 text-center text-sm text-white/40">
          {mode === "login" ? (
            <>
              No account?{" "}
              <button
                onClick={() => { setMode("signup"); setError(""); }}
                className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => { setMode("login"); setError(""); }}
                className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
