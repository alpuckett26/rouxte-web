"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

interface SaleEntry {
  id: string;
  created_at: string;
  user_id: string;
  lead_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  rep_name: string;
  lead_address: string | null;
  customer_name: string | null;
  signoffs: { action: string; note: string | null; ts: string }[];
}

interface QueueData {
  pending: SaleEntry[];
  verified: SaleEntry[];
  rejected: SaleEntry[];
}

export default function SalesQueue() {
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "verified" | "rejected">("pending");
  const [selected, setSelected] = useState<SaleEntry | null>(null);
  const [action, setAction] = useState<"sale_verified" | "sale_rejected">("sale_verified");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/manager/sales-queue")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function submit() {
    if (!selected) return;
    setSaving(true);
    const res = await fetch(`/api/manager/sales-queue/${selected.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    if (res.ok) {
      setSelected(null);
      setNote("");
      load();
    }
    setSaving(false);
  }

  const tabs = [
    { key: "pending" as const, label: "Pending", color: "yellow" },
    { key: "verified" as const, label: "Verified", color: "green" },
    { key: "rejected" as const, label: "Rejected", color: "red" },
  ] as const;

  const list = data?.[tab] ?? [];

  function getMeta(entry: SaleEntry) {
    const m = entry.metadata ?? {};
    return {
      package: (m.package as string) ?? null,
      customer: entry.customer_name ?? (m.customer_name as string) ?? null,
      install_date: (m.install_date as string) ?? null,
      commission: (m.commission_cents as number) != null
        ? `$${((m.commission_cents as number) / 100).toFixed(2)}`
        : null,
    };
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Sales Verification</h1>
        <p className="text-sm text-gray-500">Review and approve submitted sales before they are credited</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map((t) => {
          const count = data?.[t.key]?.length ?? 0;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                  t.key === "pending" ? "bg-amber-100 text-amber-700" :
                  t.key === "verified" ? "bg-green-100 text-green-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card padding="md">
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-medium text-gray-700">
              {tab === "pending" ? "No pending sales" : tab === "verified" ? "No verified sales yet" : "No rejected sales"}
            </p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((entry) => {
            const meta = getMeta(entry);
            const signoff = entry.signoffs?.[0];
            return (
              <Card key={entry.id} padding="md">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{entry.rep_name}</span>
                      {meta.package && (
                        <Badge label={meta.package} color="blue" />
                      )}
                      {tab === "verified" && <Badge label="Verified" color="green" />}
                      {tab === "rejected" && <Badge label="Rejected" color="red" />}
                    </div>

                    {/* Address / customer */}
                    {entry.lead_address && (
                      <p className="text-sm text-gray-700 truncate">{entry.lead_address}</p>
                    )}
                    {meta.customer && (
                      <p className="text-xs text-gray-500">{meta.customer}</p>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span>{new Date(entry.created_at).toLocaleDateString()}</span>
                      {meta.install_date && <span>Install: {meta.install_date}</span>}
                      {meta.commission && (
                        <span className="text-green-600 font-medium">{meta.commission}</span>
                      )}
                    </div>

                    {/* Signoff note */}
                    {signoff?.note && (
                      <p className="text-xs text-gray-500 mt-1 italic">"{signoff.note}"</p>
                    )}
                  </div>

                  {tab === "pending" && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelected(entry);
                        setAction("sale_verified");
                        setNote("");
                      }}
                    >
                      Review
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Review Sale">
        {selected && (() => {
          const meta = getMeta(selected);
          return (
            <div className="flex flex-col gap-4">
              {/* Sale details */}
              <div className="rounded-xl bg-gray-50 p-4 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{selected.rep_name}</span>
                  <span className="text-xs text-gray-400">{new Date(selected.created_at).toLocaleString()}</span>
                </div>
                {selected.lead_address && (
                  <p className="text-sm text-gray-700">{selected.lead_address}</p>
                )}
                {meta.customer && <p className="text-sm text-gray-600">{meta.customer}</p>}
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                  {meta.package && <span className="font-medium">{meta.package}</span>}
                  {meta.install_date && <span>Install: {meta.install_date}</span>}
                  {meta.commission && <span className="text-green-600 font-semibold">{meta.commission}</span>}
                </div>
                {selected.summary && (
                  <p className="text-xs text-gray-500 mt-1">{selected.summary}</p>
                )}
              </div>

              {/* Action picker */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Decision</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAction("sale_verified")}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                      action === "sale_verified"
                        ? "border-green-400 bg-green-50 text-green-700"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setAction("sale_rejected")}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                      action === "sale_rejected"
                        ? "border-red-400 bg-red-50 text-red-700"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    Reject
                  </button>
                </div>
              </div>

              {/* Note */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  Note <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder={action === "sale_rejected" ? "Reason for rejection..." : "Any notes for the rep..."}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setSelected(null)}>Cancel</Button>
                <Button
                  loading={saving}
                  onClick={submit}
                  variant={action === "sale_rejected" ? "danger" : "primary"}
                >
                  {action === "sale_verified" ? "Approve Sale" : "Reject Sale"}
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
