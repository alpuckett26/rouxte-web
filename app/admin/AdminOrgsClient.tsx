"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface OrgSummary {
  id: string;
  name: string | null;
  created_at: string;
  onboarding_completed_at: string | null;
  shape: string | null;
  subscription: {
    status: string;
    tier_key: string;
    trial_ends_at: string;
    current_period_end: string | null;
  } | null;
  user_count: number;
  lead_count: number;
}

export default function AdminOrgsClient() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [opening, setOpening] = useState<string | null>(null);

  async function handleOpen(orgId: string) {
    setOpening(orgId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/impersonate?org_id=${encodeURIComponent(orgId)}`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Open failed");
      router.refresh();
      router.push(json.redirect ?? "/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Open failed");
      setOpening(null);
    }
  }

  useEffect(() => {
    fetch("/api/admin/orgs")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setOrgs(j.data ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, []);

  const filtered = orgs?.filter((o) =>
    !q || (o.name ?? "").toLowerCase().includes(q.toLowerCase()) || o.id.includes(q)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs font-semibold tracking-wide text-red-700 uppercase">Super-admin</div>
          <h1 className="text-3xl font-bold text-gray-900">All orgs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Read-only troubleshooting view. Click any org for full details.
          </p>
        </div>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by name or id"
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!orgs ? (
        <div className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
      ) : filtered && filtered.length === 0 ? (
        <div className="text-sm text-gray-500 py-12 text-center">No orgs match that filter.</div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="text-left px-4 py-3">Org</th>
                  <th className="text-left px-4 py-3">Subscription</th>
                  <th className="text-left px-4 py-3">Shape</th>
                  <th className="text-right px-4 py-3">Users</th>
                  <th className="text-right px-4 py-3">Leads</th>
                  <th className="text-left px-4 py-3">Created</th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered?.map((o) => {
                  const isDemo = (o.name ?? "").startsWith("[DEMO");
                  return (
                    <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/admin/orgs/${o.id}`} className="font-semibold text-blue-700 hover:underline">
                          {o.name || <span className="text-gray-400 italic">unnamed</span>}
                        </Link>
                        <div className="text-[10px] text-gray-400 font-mono">{o.id.slice(0, 8)}…</div>
                      </td>
                      <td className="px-4 py-3"><SubBadge sub={o.subscription} /></td>
                      <td className="px-4 py-3 text-gray-700">{o.shape ?? <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{o.user_count}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{o.lead_count}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(o.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        {isDemo && (
                          <button
                            onClick={() => handleOpen(o.id)}
                            disabled={opening !== null}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            {opening === o.id ? "Opening…" : "Open"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SubBadge({ sub }: { sub: OrgSummary["subscription"] }) {
  if (!sub) return <span className="text-gray-300 text-xs">none</span>;
  const styles: Record<string, string> = {
    trialing:  "bg-blue-100 text-blue-700",
    active:    "bg-green-100 text-green-700",
    past_due:  "bg-amber-100 text-amber-800",
    canceled:  "bg-gray-100 text-gray-600",
    suspended: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${styles[sub.status] ?? "bg-gray-100"}`}>
      {sub.status}
      <span className="opacity-70 normal-case font-medium">· {sub.tier_key}</span>
    </span>
  );
}
