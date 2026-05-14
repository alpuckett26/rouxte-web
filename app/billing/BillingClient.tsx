"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { TIERS, formatPriceLabel, getTier } from "@/lib/billing/tiers";
import type { SquarePaymentMethod } from "@/lib/billing/square-sdk-types";

type SquareCard = SquarePaymentMethod;

interface BillingStatus {
  org_id: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "suspended";
  tier_key: string;
  trial_started_at: string;
  trial_ends_at: string;
  current_period_end: string | null;
  days_left: number;
  is_in_trial: boolean;
  square_customer_id: string | null;
  square_card_id: string | null;
  billing_email: string | null;
  billing_name: string | null;
  viewer_is_admin: boolean;
}

const SQUARE_SDK_SANDBOX = "https://sandbox.web.squarecdn.com/v1/square.js";
const SQUARE_SDK_PROD    = "https://web.squarecdn.com/v1/square.js";

export default function BillingClient() {
  const router = useRouter();
  const [status, setStatus] = useState<BillingStatus | null | "loading">("loading");
  const [updatingCard, setUpdatingCard] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setStatus("loading");
    fetch("/api/billing/status").then((r) => r.json()).then((j) => setStatus(j.data ?? null));
  }
  useEffect(refresh, []);

  if (status === "loading") {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  if (status === null) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <h1 className="text-2xl font-bold text-gray-900">No active subscription</h1>
        <p className="mt-3 text-gray-600">You don't have a Rouxte plan yet.</p>
        <Button className="mt-6" onClick={() => router.push("/dashboard")}>Start a trial →</Button>
      </div>
    );
  }

  const tier = getTier(status.tier_key) ?? TIERS[0];
  const trialEndsDisplay = new Date(status.trial_ends_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

  async function doCancel() {
    setCanceling(true);
    setError(null);
    try {
      const r = await fetch("/api/billing/cancel", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Cancel failed");
      setCancelOpen(false);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCanceling(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Billing</h1>
        <p className="mt-1 text-gray-600">Manage your Rouxte subscription, payment method, and invoices.</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Plan card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Current plan</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">Rouxte {tier.name}</div>
            <div className="mt-1 text-gray-600">{formatPriceLabel(tier)}</div>
          </div>
          <StatusBadge status={status.status} />
        </div>

        <div className="mt-6 grid sm:grid-cols-2 gap-4">
          <Info label="Status" value={
            status.is_in_trial ? `Free trial · ${status.days_left} day${status.days_left === 1 ? "" : "s"} left` :
            status.status === "active" ? "Active" :
            status.status === "past_due" ? "Payment failed · grace period" :
            status.status === "canceled" ? "Canceled" :
            "Suspended"
          } />
          <Info label={status.is_in_trial ? "Trial ends" : "Next billing"} value={trialEndsDisplay} />
        </div>
      </div>

      {/* Payment method */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-gray-900">Payment method</div>
            <div className="mt-1 text-sm text-gray-600">
              {status.square_card_id ? "Card on file with Square" : "No card on file yet"}
            </div>
          </div>
          {status.viewer_is_admin && status.status !== "canceled" && (
            <Button variant="secondary" onClick={() => { setUpdatingCard(true); setError(null); }}>
              {status.square_card_id ? "Update card" : "Add card"}
            </Button>
          )}
        </div>

        {status.billing_email && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid sm:grid-cols-2 gap-4">
            <Info label="Billing name"  value={status.billing_name ?? "—"} />
            <Info label="Billing email" value={status.billing_email} />
          </div>
        )}
      </div>

      {/* Danger zone */}
      {status.viewer_is_admin && status.status !== "canceled" && (
        <div className="rounded-2xl border border-red-100 bg-red-50/30 p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-red-900">Cancel subscription</div>
              <div className="mt-1 text-sm text-red-800/80">
                You'll keep access until {trialEndsDisplay}. Re-subscribe anytime to come back.
              </div>
            </div>
            <Button variant="danger" onClick={() => setCancelOpen(true)}>Cancel plan</Button>
          </div>
        </div>
      )}

      {updatingCard && (
        <CardUpdateModal
          defaultEmail={status.billing_email ?? ""}
          defaultName={status.billing_name ?? ""}
          submitting={submitting}
          setSubmitting={setSubmitting}
          setError={setError}
          onClose={() => setUpdatingCard(false)}
          onSaved={() => { setUpdatingCard(false); refresh(); }}
        />
      )}

      {cancelOpen && (
        <CancelConfirmModal
          onClose={() => setCancelOpen(false)}
          onConfirm={doCancel}
          loading={canceling}
        />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide font-semibold text-gray-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-gray-900">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: BillingStatus["status"] }) {
  const styles: Record<BillingStatus["status"], string> = {
    trialing:  "bg-blue-100 text-blue-700",
    active:    "bg-green-100 text-green-700",
    past_due:  "bg-amber-100 text-amber-800",
    canceled:  "bg-gray-100 text-gray-600",
    suspended: "bg-red-100 text-red-700",
  };
  const labels: Record<BillingStatus["status"], string> = {
    trialing: "Trial", active: "Active", past_due: "Past due", canceled: "Canceled", suspended: "Suspended",
  };
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>;
}

/* ──────────────────────── Card Update Modal ──────────────────────── */

function CardUpdateModal({
  defaultEmail, defaultName, submitting, setSubmitting, setError, onClose, onSaved,
}: {
  defaultEmail: string; defaultName: string;
  submitting: boolean; setSubmitting: (b: boolean) => void;
  setError: (s: string | null) => void;
  onClose: () => void; onSaved: () => void;
}) {
  const [billingEmail, setBillingEmail] = useState(defaultEmail);
  const [billingName, setBillingName] = useState(defaultName);
  const cardRef = useRef<SquareCard | null>(null);
  const containerId = "billing-update-card";

  const sqEnv = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";
  const sqAppId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID;
  const sqLocation = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;

  useEffect(() => {
    if (!sqAppId || !sqLocation) {
      setError("Square is not configured (missing NEXT_PUBLIC_SQUARE_* env)");
      return;
    }
    const src = sqEnv === "production" ? SQUARE_SDK_PROD : SQUARE_SDK_SANDBOX;
    let cancelled = false;
    let cleanupCard: SquareCard | null = null;

    const init = async () => {
      if (!window.Square) {
        await new Promise<void>((resolve, reject) => {
          const ex = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
          if (ex) { ex.addEventListener("load", () => resolve()); return; }
          const s = document.createElement("script"); s.src = src; s.async = true;
          s.onload = () => resolve(); s.onerror = () => reject(new Error("Failed to load Square SDK"));
          document.body.appendChild(s);
        });
      }
      if (cancelled || !window.Square) return;
      try {
        const payments = await window.Square.payments(sqAppId, sqLocation);
        const card = await payments.card();
        await card.attach(`#${containerId}`);
        if (cancelled) return;
        cardRef.current = card;
        cleanupCard = card;
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Square form failed to load");
      }
    };
    init();
    return () => { cancelled = true; cleanupCard?.destroy?.().catch(() => {}); cardRef.current = null; };
  }, [sqAppId, sqLocation, sqEnv, setError]);

  async function submit() {
    if (!cardRef.current) return;
    setSubmitting(true); setError(null);
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== "OK" || !result.token) {
        throw new Error(result.errors?.[0]?.message || "Card details look invalid");
      }
      const r = await fetch("/api/billing/update-card", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: result.token, billing_email: billingEmail, billing_name: billingName }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Card update failed");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Card update failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-gray-900/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-8 my-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Update card</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="block text-xs font-semibold tracking-wide text-gray-600 uppercase mb-1.5">Billing name</span>
            <input type="text" value={billingName} onChange={(e) => setBillingName(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold tracking-wide text-gray-600 uppercase mb-1.5">Billing email</span>
            <input type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold tracking-wide text-gray-600 uppercase mb-1.5">Card</span>
            <div id={containerId} className="min-h-[88px] rounded-xl border border-gray-200 p-3" />
          </label>
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={submitting}>Cancel</Button>
          <Button onClick={submit} loading={submitting} className="flex-1">Save card</Button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────── Cancel Confirm Modal ──────────────────────── */

function CancelConfirmModal({ onClose, onConfirm, loading }: { onClose: () => void; onConfirm: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-[100] bg-gray-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
        <h2 className="text-xl font-bold text-gray-900">Cancel your subscription?</h2>
        <p className="mt-2 text-gray-600">
          You'll keep full access until the end of your current period. After that, your org will be locked out
          until you re-subscribe.
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={loading}>Keep my plan</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading} className="flex-1">Cancel anyway</Button>
        </div>
      </div>
    </div>
  );
}
