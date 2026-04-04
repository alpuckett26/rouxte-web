"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

interface InviteInfo {
  email: string;
  role: string;
  org: { name: string };
  team: { name: string } | null;
  expires_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  sales_rep: "Sales Rep",
  team_lead: "Team Lead",
  sales_manager: "Sales Manager",
  admin: "Admin",
};

type State = "loading" | "ready" | "accepting" | "done" | "error";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [state, setState] = useState<State>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setErrorMsg(d.error); setState("error"); }
        else { setInvite(d.data); setState("ready"); }
      })
      .catch(() => { setErrorMsg("Failed to load invite"); setState("error"); });
  }, [token]);

  async function accept() {
    setState("accepting");
    try {
      const res = await fetch(`/api/invites/${token}/accept`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          // Not logged in — send to auth with return URL
          router.push(`/auth?next=/invite/${token}`);
          return;
        }
        throw new Error(d.error ?? "Failed to accept invite");
      }
      setState("done");
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center">
            <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
              <path d="M8 8 L24 24 M24 8 L8 24" stroke="url(#invite-grad)" strokeWidth="4" strokeLinecap="round" />
              <defs>
                <linearGradient id="invite-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          {state === "loading" && (
            <div className="flex flex-col gap-3 animate-pulse">
              <div className="h-6 bg-gray-100 rounded w-3/4" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
              <div className="h-10 bg-gray-100 rounded mt-4" />
            </div>
          )}

          {state === "done" && (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-1">You&apos;re in!</h1>
              <p className="text-sm text-gray-500">Redirecting you to the dashboard…</p>
            </div>
          )}

          {state === "error" && (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-1">Invite unavailable</h1>
              <p className="text-sm text-gray-500">{errorMsg}</p>
            </div>
          )}

          {(state === "ready" || state === "accepting") && invite && (
            <>
              <div className="mb-6">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">You&apos;ve been invited to join</p>
                <h1 className="text-2xl font-bold text-gray-900">{invite.org.name}</h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-sm text-gray-600">
                    as <span className="font-medium text-gray-900">{ROLE_LABELS[invite.role] ?? invite.role}</span>
                  </span>
                  {invite.team && (
                    <span className="text-sm text-gray-500">· Team: {invite.team.name}</span>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 mb-6 text-sm text-blue-700">
                Invite sent to <span className="font-medium">{invite.email}</span>
                <br />
                <span className="text-xs text-blue-500">
                  Expires {new Date(invite.expires_at).toLocaleDateString()}
                </span>
              </div>

              <Button
                loading={state === "accepting"}
                onClick={accept}
                className="w-full"
                size="lg"
              >
                Accept & Join {invite.org.name}
              </Button>

              <p className="text-xs text-gray-400 mt-4 text-center">
                You&apos;ll need to be logged in. If you don&apos;t have an account, you&apos;ll be redirected to sign up.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
