"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTier } from "@/lib/billing/tiers";

interface OrgDetail {
  org: {
    id: string;
    name: string | null;
    created_at: string;
    onboarding_state: Record<string, unknown> | null;
    onboarding_completed_at: string | null;
  };
  subscription: {
    status: string;
    tier_key: string;
    trial_started_at: string;
    trial_ends_at: string;
    current_period_end: string | null;
    failed_charge_count: number | null;
    last_charge_attempt_at: string | null;
    square_customer_id: string | null;
    square_card_id: string | null;
    billing_email: string | null;
  } | null;
  billing_charges: Array<{
    id: string;
    amount_cents: number;
    rep_count: number;
    tier_key: string;
    period_start: string;
    period_end: string;
    status: string;
    failure_reason: string | null;
    square_payment_id: string | null;
    created_at: string;
  }>;
  users: Array<{
    user_id: string;
    role: string;
    full_name: string | null;
    team_id: string | null;
    onboarding_step: string | null;
    onboarding_complete: boolean | null;
    created_at: string;
  }>;
  lead_counts: Record<string, number>;
  lead_total: number;
  recent_activity: Array<{
    id: string;
    lead_id: string | null;
    actor_id: string | null;
    event_type: string;
    summary: string | null;
    is_incident: boolean;
    created_at: string;
  }>;
  invites: Array<{
    id: string;
    email: string;
    role: string;
    created_at: string;
    accepted_at: string | null;
  }>;
  comp_plans: Array<{
    id: string;
    carrier: string;
    product: string;
    rep_payout_cents: number;
    manager_override_cents: number;
    lead_override_cents: number;
  }>;
}

export default function AdminOrgDetailClient({ orgId }: { orgId: string }) {
  const [data, setData] = useState<OrgDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/orgs/${orgId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setData(j.data ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [orgId]);

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 max-w-2xl">
        {error}
      </div>
    );
  }
  if (!data) {
    return <div className="h-64 rounded-2xl bg-gray-100 animate-pulse" />;
  }

  const onb = data.org.onboarding_state as Record<string, unknown> | null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">← All orgs</Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">
          {data.org.name || <span className="text-gray-400 italic">unnamed org</span>}
        </h1>
        <div className="mt-1 text-xs text-gray-500 font-mono">{data.org.id}</div>
      </div>

      {/* Subscription card */}
      <Section title="Subscription">
        {data.subscription ? (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat label="Status" value={data.subscription.status} />
              <Stat label="Tier" value={data.subscription.tier_key} />
              <Stat label="Trial ends" value={fmtDate(data.subscription.trial_ends_at)} />
              <Stat label="Next billing" value={data.subscription.current_period_end ? fmtDate(data.subscription.current_period_end) : "—"} />
              <Stat label="Card on file" value={data.subscription.square_card_id ? "Yes" : "No"} />
              <Stat label="Failed charges" value={String(data.subscription.failed_charge_count ?? 0)} />
              <Stat label="Last attempt" value={data.subscription.last_charge_attempt_at ? fmtDate(data.subscription.last_charge_attempt_at) : "Never"} />
              <Stat label="Billing email" value={data.subscription.billing_email ?? "—"} />
            </div>
            <ForceRenewalButton
              orgId={orgId}
              tierKey={data.subscription.tier_key}
              userCount={data.users.length}
              hasCard={!!data.subscription.square_card_id}
            />
          </>
        ) : (
          <div className="text-sm text-gray-500">No subscription record.</div>
        )}
      </Section>

      {/* Billing charges */}
      <Section title={`Recent charges (${data.billing_charges.length})`}>
        {data.billing_charges.length === 0 ? (
          <div className="text-sm text-gray-500">No charges yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
              <tr>
                <th className="py-2">Period start</th>
                <th>Tier</th>
                <th className="text-right">Reps</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
                <th>Square ID</th>
              </tr>
            </thead>
            <tbody>
              {data.billing_charges.map((c) => (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="py-2">{fmtDate(c.period_start)}</td>
                  <td>{c.tier_key}</td>
                  <td className="text-right tabular-nums">{c.rep_count}</td>
                  <td className="text-right tabular-nums">${(c.amount_cents / 100).toFixed(2)}</td>
                  <td>
                    <span className={[
                      "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold",
                      c.status === "succeeded" ? "bg-green-100 text-green-700" :
                      c.status === "failed"    ? "bg-red-100 text-red-700" :
                                                  "bg-amber-100 text-amber-800",
                    ].join(" ")}>
                      {c.status}
                    </span>
                    {c.failure_reason && <div className="text-[10px] text-red-600 mt-0.5">{c.failure_reason}</div>}
                  </td>
                  <td className="text-[10px] text-gray-400 font-mono">{c.square_payment_id ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Users */}
      <Section title={`Users (${data.users.length})`}>
        {data.users.length === 0 ? (
          <div className="text-sm text-gray-500">No users.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
              <tr>
                <th className="py-2">Name</th>
                <th>Role</th>
                <th>Onboarding</th>
                <th>Joined</th>
                <th>User ID</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.user_id} className="border-b border-gray-100">
                  <td className="py-2">{u.full_name || <span className="text-gray-400 italic">—</span>}</td>
                  <td><RoleEditor userId={u.user_id} role={u.role} /></td>
                  <td>
                    {u.onboarding_complete
                      ? <span className="text-green-700 text-xs">complete</span>
                      : <span className="text-amber-700 text-xs">{u.onboarding_step ?? "in-progress"}</span>}
                  </td>
                  <td className="text-xs text-gray-500">{fmtDate(u.created_at)}</td>
                  <td className="text-[10px] text-gray-400 font-mono">{u.user_id.slice(0, 8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Lead counts + invites + comp plans */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Section title="Leads by status" compact>
          {data.lead_total === 0 ? (
            <div className="text-sm text-gray-500">No leads yet.</div>
          ) : (
            <div className="space-y-1.5 text-sm">
              {Object.entries(data.lead_counts).sort(([, a], [, b]) => b - a).map(([status, n]) => (
                <div key={status} className="flex justify-between">
                  <span className="text-gray-700">{status}</span>
                  <span className="font-mono tabular-nums text-gray-900">{n}</span>
                </div>
              ))}
              <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between font-semibold">
                <span>Total</span>
                <span className="font-mono tabular-nums">{data.lead_total}</span>
              </div>
            </div>
          )}
        </Section>

        <Section title={`Invites (${data.invites.length})`} compact>
          {data.invites.length === 0 ? (
            <div className="text-sm text-gray-500">No invites.</div>
          ) : (
            <div className="space-y-1.5 text-xs">
              {data.invites.slice(0, 10).map((i) => (
                <div key={i.id} className="flex justify-between gap-2">
                  <span className="truncate text-gray-700">{i.email}</span>
                  <span className={i.accepted_at ? "text-green-700" : "text-amber-700"}>
                    {i.accepted_at ? "accepted" : i.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title={`Comp plans (${data.comp_plans.length})`} compact>
          {data.comp_plans.length === 0 ? (
            <div className="text-sm text-gray-500">No comp plans set.</div>
          ) : (
            <div className="space-y-1.5 text-xs">
              {data.comp_plans.slice(0, 10).map((p) => (
                <div key={p.id} className="flex justify-between gap-2">
                  <span className="truncate text-gray-700">{p.carrier} · {p.product}</span>
                  <span className="font-mono tabular-nums">${(p.rep_payout_cents / 100).toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Recent activity */}
      <Section title={`Recent activity (last ${data.recent_activity.length})`}>
        {data.recent_activity.length === 0 ? (
          <div className="text-sm text-gray-500">No activity yet.</div>
        ) : (
          <div className="space-y-1 text-xs">
            {data.recent_activity.map((e) => (
              <div key={e.id} className="flex gap-3 py-1.5 border-b border-gray-50 last:border-b-0">
                <span className="text-gray-400 font-mono w-32 shrink-0">{fmtTime(e.created_at)}</span>
                <span className={["w-44 shrink-0 font-semibold", e.is_incident ? "text-red-700" : "text-gray-700"].join(" ")}>
                  {e.event_type}
                </span>
                <span className="text-gray-600 truncate">{e.summary ?? <span className="text-gray-400">—</span>}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Raw onboarding state */}
      {onb && (
        <Section title="Onboarding state (raw)" compact>
          <pre className="text-[10px] font-mono bg-gray-50 rounded-lg p-3 overflow-x-auto text-gray-700">
            {JSON.stringify(onb, null, 2)}
          </pre>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children, compact }: { title: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold uppercase tracking-wide text-gray-600">
        {title}
      </div>
      <div className={compact ? "p-4" : "p-5"}>{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide font-semibold text-gray-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}

const ROLE_OPTIONS = ["admin", "sales_manager", "team_lead", "sales_rep"] as const;
const ROLE_COLORS: Record<string, string> = {
  admin:         "bg-purple-100 text-purple-700",
  sales_manager: "bg-blue-100 text-blue-700",
  team_lead:     "bg-teal-100 text-teal-700",
  sales_rep:     "bg-gray-100 text-gray-700",
};

function RoleEditor({ userId, role }: { userId: string; role: string }) {
  const [current, setCurrent] = useState(role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changeRole(next: string) {
    if (next === current) return;
    const previous = current;
    setCurrent(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Update failed (${res.status})`);
    } catch (e) {
      setCurrent(previous); // rollback on failure
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={current}
        onChange={(e) => changeRole(e.target.value)}
        disabled={saving}
        className={[
          "rounded-full px-2 py-0.5 text-[10px] font-semibold border-0 cursor-pointer",
          "focus:outline-none focus:ring-2 focus:ring-blue-500",
          ROLE_COLORS[current] ?? "bg-gray-100 text-gray-700",
          saving ? "opacity-60" : "",
        ].join(" ")}
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      {saving && <span className="text-[10px] text-gray-400">saving…</span>}
      {error && <span className="text-[10px] text-red-600" title={error}>!</span>}
    </div>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function ForceRenewalButton({
  orgId, tierKey, userCount, hasCard,
}: {
  orgId: string;
  tierKey: string;
  userCount: number;
  hasCard: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ action: string; amount_cents?: number; payment_id?: string; reason?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tier = getTier(tierKey);
  const pricePerRep = tier?.monthly_price_cents ?? 0;
  const estimatedCents = pricePerRep * userCount;

  async function run() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/force-renewal`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Renewal failed (${res.status})`);
      setResult(j.result);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Renewal failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-6 pt-5 border-t border-gray-100">
      {!confirming && !result && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={!hasCard || estimatedCents === 0}
          className="text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ⚡ Force renewal now
        </button>
      )}
      {!hasCard && !result && (
        <span className="ml-3 text-xs text-gray-500">No card on file</span>
      )}

      {confirming && !result && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 max-w-xl">
          <div className="font-semibold text-red-900">Charge this org's card now?</div>
          <div className="mt-2 text-sm text-red-800">
            This will run the renewal engine with <code>force=true</code> against Square. Real money moves —
            no trial, no waiting.
          </div>
          <div className="mt-3 rounded-lg bg-white border border-red-200 p-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Tier</span><span className="font-semibold">{tier?.name ?? tierKey}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Per-rep price</span><span className="font-mono tabular-nums">${(pricePerRep / 100).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Rep count</span><span className="font-mono tabular-nums">{userCount}</span></div>
            <div className="flex justify-between mt-2 pt-2 border-t border-gray-100 font-bold">
              <span>Total</span>
              <span className="font-mono tabular-nums">${(estimatedCents / 100).toFixed(2)}</span>
            </div>
          </div>
          {error && <div className="mt-3 text-sm text-red-700">{error}</div>}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setConfirming(false)} disabled={submitting}
              className="text-sm font-medium text-gray-600 px-3 py-2 rounded-lg hover:bg-white">
              Cancel
            </button>
            <button type="button" onClick={run} disabled={submitting}
              className="text-sm font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg disabled:opacity-50">
              {submitting ? "Charging…" : `Charge $${(estimatedCents / 100).toFixed(2)}`}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className={[
          "rounded-xl p-4 max-w-xl",
          result.action === "charged" ? "bg-green-50 border border-green-200 text-green-900" :
          result.action === "failed" || result.action === "suspended" ? "bg-red-50 border border-red-200 text-red-900" :
          "bg-amber-50 border border-amber-200 text-amber-900",
        ].join(" ")}>
          <div className="font-semibold">Result: {result.action}</div>
          {result.amount_cents !== undefined && (
            <div className="mt-1 text-sm">
              Amount: <span className="font-mono">${(result.amount_cents / 100).toFixed(2)}</span>
            </div>
          )}
          {result.payment_id && (
            <div className="mt-1 text-xs font-mono opacity-70">Square ID: {result.payment_id}</div>
          )}
          {result.reason && (
            <div className="mt-1 text-sm">Reason: {result.reason}</div>
          )}
          <button type="button" onClick={() => { setResult(null); window.location.reload(); }}
            className="mt-3 text-xs font-semibold underline">Refresh page →</button>
        </div>
      )}
    </div>
  );
}
