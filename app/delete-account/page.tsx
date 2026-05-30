"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Phase = "checking" | "signed-out" | "ready" | "deleting" | "done" | "error";

export default function DeleteAccountPage() {
  const router = useRouter();
  const supabase = createClient();
  const [phase, setPhase] = useState<Phase>("checking");
  const [email, setEmail] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email ?? null);
        setPhase("ready");
      } else {
        setPhase("signed-out");
      }
    })();
  }, [supabase]);

  async function handleDelete() {
    setPhase("deleting");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      // Clear the local session so the banned account can't keep using cookies.
      await supabase.auth.signOut();
      setPhase("done");
    } catch (e) {
      setErrorMsg((e as Error).message);
      setPhase("error");
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="Rouxte" className="h-7" />
          </Link>
          <Link href="/privacy" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Privacy
          </Link>
        </div>
      </header>

      <article className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-900">Delete your Rouxte account</h1>

        <p className="mt-4 text-gray-700">
          You can permanently delete your Rouxte account and personal information at any time,
          from this page or from the mobile app (<span className="font-medium">Settings &rarr;
          Delete account</span>).
        </p>

        <div className="mt-6 rounded-lg border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900">What gets deleted</h2>
          <ul className="mt-2 list-disc pl-5 text-gray-700 space-y-1">
            <li>Your name, profile photo, phone number, and email</li>
            <li>Your sign-in credentials — you will no longer be able to log in</li>
          </ul>
          <h2 className="mt-4 font-semibold text-gray-900">What we retain (de-identified)</h2>
          <ul className="mt-2 list-disc pl-5 text-gray-700 space-y-1">
            <li>
              Commission, payroll, and tax records we are legally required to keep, with personal
              identifiers removed
            </li>
            <li>
              Append-only compliance logs (e.g. do-not-knock, opt-out records) required for legal
              and dispute-resolution purposes, with personal identifiers removed
            </li>
          </ul>
          <p className="mt-3 text-sm text-gray-500">
            Deletion is immediate and cannot be undone. Retained records are purged on the schedule
            in our <Link href="/privacy" className="underline">Privacy Policy</Link>.
          </p>
        </div>

        {phase === "checking" && (
          <p className="mt-8 text-gray-500">Checking your session…</p>
        )}

        {phase === "signed-out" && (
          <div className="mt-8 rounded-lg bg-gray-50 border border-gray-200 p-4">
            <p className="text-gray-700">
              Sign in to delete your account, so we can verify it&apos;s really you.
            </p>
            <Link
              href="/auth"
              className="mt-3 inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Sign in to continue
            </Link>
            <p className="mt-4 text-sm text-gray-500">
              Can&apos;t sign in? Email{" "}
              <a href="mailto:privacy@rouxte.com" className="underline">privacy@rouxte.com</a>{" "}
              from your account address and we&apos;ll process the deletion within 30 days.
            </p>
          </div>
        )}

        {(phase === "ready" || phase === "deleting" || phase === "error") && (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-gray-800">
              Signed in as <span className="font-medium">{email ?? "your account"}</span>. To
              confirm, type <span className="font-mono font-semibold">DELETE</span> below.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 font-mono"
              autoCapitalize="characters"
            />
            {errorMsg && <p className="mt-3 text-sm text-red-700">{errorMsg}</p>}
            <button
              onClick={handleDelete}
              disabled={confirmText !== "DELETE" || phase === "deleting"}
              className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
            >
              {phase === "deleting" ? "Deleting…" : "Permanently delete my account"}
            </button>
          </div>
        )}

        {phase === "done" && (
          <div className="mt-8 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-gray-800 font-medium">Your account has been deleted.</p>
            <p className="mt-1 text-gray-700">
              Your personal information has been removed and you have been signed out.
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-3 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Return home
            </button>
          </div>
        )}
      </article>
    </div>
  );
}
