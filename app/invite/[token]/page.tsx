"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

interface InviteInfo {
  email: string;
  role: string;
  org: { name: string };
  team: { name: string } | null;
  expires_at: string;
  accepted_at: string | null;
}

interface InviterInfo { full_name: string | null }

const ROLE_LABELS: Record<string, string> = {
  sales_rep:     "Sales Rep",
  team_lead:     "Team Lead",
  sales_manager: "Sales Manager",
  admin:         "Admin",
};

type State =
  | { kind: "loading" }
  | { kind: "ready"; invite: InviteInfo; inviter: InviterInfo | null; viewerEmail: string | null }
  | { kind: "accepting"; invite: InviteInfo }
  | { kind: "done" }
  | { kind: "expired" }
  | { kind: "already_accepted" }
  | { kind: "not_found" }
  | { kind: "email_mismatch"; inviteEmail: string; viewerEmail: string }
  | { kind: "error"; message: string };

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const viewerEmail = user?.email ?? null;

        const res = await fetch(`/api/invites/${token}`);
        const json = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          // Map server-side errors to our states
          if (res.status === 404 || /not found/i.test(json.error ?? "")) {
            setState({ kind: "not_found" });
            return;
          }
          if (/expired/i.test(json.error ?? "")) {
            setState({ kind: "expired" });
            return;
          }
          if (/already accepted/i.test(json.error ?? "")) {
            setState({ kind: "already_accepted" });
            return;
          }
          setState({ kind: "error", message: json.error ?? "Failed to load invite" });
          return;
        }

        const invite: InviteInfo = json.data;
        if (invite.accepted_at) { setState({ kind: "already_accepted" }); return; }
        if (new Date(invite.expires_at) < new Date()) { setState({ kind: "expired" }); return; }

        // Email-mismatch detection (client-side preview — server enforces too)
        if (viewerEmail && invite.email && viewerEmail.toLowerCase() !== invite.email.toLowerCase()) {
          setState({ kind: "email_mismatch", inviteEmail: invite.email, viewerEmail });
          return;
        }

        setState({ kind: "ready", invite, inviter: null, viewerEmail });
      } catch (e) {
        if (cancelled) return;
        setState({ kind: "error", message: e instanceof Error ? e.message : "Failed to load invite" });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [token]);

  async function accept() {
    if (state.kind !== "ready") return;
    const invite = state.invite;
    setState({ kind: "accepting", invite });
    try {
      // POST to the correct route — /api/invites/[token] (was previously /accept which 404'd)
      const res = await fetch(`/api/invites/${token}`, { method: "POST" });
      let json: { error?: string; code?: string; ok?: boolean } = {};
      try { json = await res.json(); } catch {}

      if (!res.ok) {
        if (res.status === 401 || json.code === "unauthenticated") {
          router.push(`/auth?next=${encodeURIComponent(`/invite/${token}`)}`);
          return;
        }
        if (json.code === "email_mismatch") {
          setState({ kind: "email_mismatch", inviteEmail: invite.email, viewerEmail: state.viewerEmail ?? "" });
          return;
        }
        if (json.code === "expired") { setState({ kind: "expired" }); return; }
        if (json.code === "already_accepted") { setState({ kind: "already_accepted" }); return; }
        setState({ kind: "error", message: json.error ?? "Could not accept the invite. Please try again." });
        return;
      }

      setState({ kind: "done" });
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Could not accept the invite." });
    }
  }

  function goToAuth() {
    router.push(`/auth?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 to-blue-50 flex items-start sm:items-center justify-center px-4 pt-12 sm:pt-4 pb-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-md flex items-center justify-center">
            <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
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

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8">
          {state.kind === "loading" && (
            <div className="flex flex-col gap-3 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/2" />
              <div className="h-7 bg-gray-100 rounded w-3/4" />
              <div className="h-4 bg-gray-100 rounded w-1/3" />
              <div className="h-12 bg-gray-100 rounded mt-4" />
            </div>
          )}

          {(state.kind === "ready" || state.kind === "accepting") && (
            <ReadyCard
              invite={state.invite}
              loading={state.kind === "accepting"}
              onAccept={accept}
              viewerEmail={state.kind === "ready" ? state.viewerEmail : null}
            />
          )}

          {state.kind === "done" && (
            <CenteredMessage
              icon={<CheckIcon />}
              tone="success"
              title="You're in!"
              body="Redirecting you to the dashboard…"
            />
          )}

          {state.kind === "expired" && (
            <CenteredMessage
              icon={<ClockIcon />}
              tone="amber"
              title="This invite has expired."
              body="Ask your team admin to send a new invite."
              action={null}
            />
          )}

          {state.kind === "already_accepted" && (
            <CenteredMessage
              icon={<CheckIcon />}
              tone="success"
              title="This invite has already been accepted."
              body="If that was you, you're good — head to your dashboard."
              action={<Button className="w-full" onClick={() => router.push("/dashboard")}>Go to dashboard</Button>}
            />
          )}

          {state.kind === "not_found" && (
            <CenteredMessage
              icon={<XIcon />}
              tone="red"
              title="We couldn't find this invite."
              body="Check the link or ask your team admin to resend it."
            />
          )}

          {state.kind === "email_mismatch" && (
            <CenteredMessage
              icon={<WarnIcon />}
              tone="amber"
              title="Wrong account."
              body={
                <>
                  This invite was sent to{" "}
                  <strong className="text-gray-900">{state.inviteEmail}</strong>.
                  You're currently signed in as{" "}
                  <strong className="text-gray-900">{state.viewerEmail}</strong>.
                  Please log in with the invited email or ask your team admin for a new invite.
                </>
              }
              action={
                <div className="flex flex-col gap-2">
                  <Button variant="secondary" className="w-full" onClick={goToAuth}>
                    Sign in with another account
                  </Button>
                </div>
              }
            />
          )}

          {state.kind === "error" && (
            <CenteredMessage
              icon={<XIcon />}
              tone="red"
              title="Something went wrong."
              body={state.message}
            />
          )}
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-4">
          rouxte.com · Door-to-door telecom OS
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */

function ReadyCard({
  invite, loading, onAccept, viewerEmail,
}: {
  invite: InviteInfo;
  loading: boolean;
  onAccept: () => void;
  viewerEmail: string | null;
}) {
  const roleLabel = ROLE_LABELS[invite.role] ?? invite.role;
  const teamLabel = invite.team?.name ?? null;
  const expiresLabel = new Date(invite.expires_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  // The main heading is the team if there is one, else the org name.
  const heading = teamLabel ?? invite.org.name;
  const supporting = teamLabel ? `Team within ${invite.org.name}` : "Rouxte team";

  return (
    <>
      <p className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-1">
        You&apos;ve been invited to join a Rouxte team
      </p>
      <h1 className="text-3xl font-bold text-gray-900 leading-tight">{heading}</h1>
      <p className="text-sm text-gray-500 mt-0.5">{supporting}</p>

      <div className="mt-5 flex flex-col gap-2">
        <Pill label="Role" value={roleLabel} />
        <Pill label="Inviter" value={invite.email ? `Sent to ${invite.email}` : "—"} />
      </div>

      <div className="mt-5 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-800">
        Invite expires <strong>{expiresLabel}</strong>.
        {viewerEmail && (
          <div className="mt-1 text-blue-700">
            Signed in as <strong>{viewerEmail}</strong>.
          </div>
        )}
      </div>

      <Button
        loading={loading}
        onClick={onAccept}
        className="w-full mt-5"
        size="lg"
      >
        Accept Invite
      </Button>

      <p className="text-xs text-gray-500 mt-3 text-center leading-relaxed">
        Log in or create an account to accept this invite. We&apos;ll bring you back here automatically.
      </p>
    </>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
      <span className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">{label}</span>
      <span className="text-sm font-medium text-gray-900 truncate ml-3 max-w-[60%] text-right">{value}</span>
    </div>
  );
}

function CenteredMessage({
  icon, tone, title, body, action,
}: {
  icon: React.ReactNode;
  tone: "success" | "amber" | "red";
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
}) {
  const bg = tone === "success" ? "bg-green-100 text-green-600"
           : tone === "amber"   ? "bg-amber-100 text-amber-700"
           :                       "bg-red-100 text-red-600";
  return (
    <div className="text-center">
      <div className={`w-14 h-14 rounded-full ${bg} flex items-center justify-center mx-auto mb-4`}>
        {icon}
      </div>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">{title}</h1>
      <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
      {action !== undefined && action !== null && <div className="mt-5">{action}</div>}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function WarnIcon() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}
