"use client";

import { useEffect, useState, useCallback } from "react";
import Button from "@/components/ui/Button";

interface RepLead {
  id: string;
  address: string;
  status: string;
  assigned_at: string | null;
  customer_name: string | null;
}

interface RepLeadData {
  rep_id: string;
  rep_name: string;
  total: number;
  worked: number;
  worked_pct: number;
  oldest_age_days: number | null;
  leads: RepLead[];
}

const STATUS_LABEL: Record<string, string> = {
  new:         "New",
  attempted:   "Attempted",
  interested:  "Interested",
  appointment: "Appointment",
  sold:        "Sold",
  lost:        "Lost",
};

const STATUS_COLOR: Record<string, string> = {
  new:         "bg-gray-100 text-gray-600",
  attempted:   "bg-yellow-100 text-yellow-700",
  interested:  "bg-purple-100 text-purple-700",
  appointment: "bg-orange-100 text-orange-700",
  sold:        "bg-green-100 text-green-700",
  lost:        "bg-red-100 text-red-600",
};

const PROTECTED = ["appointment", "sold"];

interface Props {
  repId: string;
  repName: string;
  onClose: () => void;
  onPulled: () => void;
}

export default function RepLeadPullModal({ repId, repName, onClose, onPulled }: Props) {
  const [data, setData] = useState<RepLeadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [reason, setReason] = useState("");
  const [pulling, setPulling] = useState(false);
  const [warning, setWarning] = useState<{ protected_leads: Array<{ id: string; status: string; address: string }> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/manager/leads/rep-leads?rep_id=${repId}`);
    const json = await res.json();
    setData(json.data ?? null);
    setLoading(false);
  }, [repId]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  function toggleLead(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSelectAll(checked: boolean) {
    setSelectAll(checked);
    if (checked && data) {
      setSelected(new Set(data.leads.map((l) => l.id)));
    } else {
      setSelected(new Set());
    }
  }

  async function doPull(force = false) {
    if (!data) return;
    setPulling(true);
    setError(null);

    const body: Record<string, unknown> = {
      rep_id:   repId,
      lead_ids: selected.size > 0 ? [...selected] : undefined,
      reason:   reason || "Manager pull",
      force,
    };

    const res  = await fetch("/api/manager/leads/pull", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    const json = await res.json();

    if (json.warning === "protected_leads") {
      setWarning({ protected_leads: json.protected_leads });
      setPulling(false);
      return;
    }

    if (!res.ok) {
      setError(json.error ?? "Pull failed");
      setPulling(false);
      return;
    }

    onPulled();
    onClose();
  }

  const leads = data?.leads ?? [];
  const selectedLeads = leads.filter((l) => selected.has(l.id));
  const selectedHasProtected = selectedLeads.some((l) => PROTECTED.includes(l.status));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Pull Leads from {repName}</h2>
            {data && (
              <p className="text-xs text-gray-500 mt-0.5">
                {data.total} total · {data.worked_pct}% worked
                {data.oldest_age_days != null && ` · oldest unworked: ${data.oldest_age_days}d ago`}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Warning banner for protected leads */}
        {warning && (
          <div className="mx-6 mt-4 rounded-xl bg-orange-50 border border-orange-200 p-4">
            <p className="text-sm font-semibold text-orange-800 mb-1">
              {warning.protected_leads.length} lead(s) are past appointment stage
            </p>
            <ul className="text-xs text-orange-700 space-y-0.5 mb-3">
              {warning.protected_leads.map((l) => (
                <li key={l.id}>• {l.address} — <span className="font-medium">{STATUS_LABEL[l.status] ?? l.status}</span></li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setWarning(null)}>Cancel</Button>
              <button
                onClick={() => { setWarning(null); doPull(true); }}
                className="text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 px-3 py-1.5 rounded-lg"
              >
                Pull All Including Protected
              </button>
            </div>
          </div>
        )}

        {/* Activity ratio bar */}
        {data && (
          <div className="px-6 pt-4 pb-2">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>Worked</span>
              <span>{data.worked}/{data.total} leads ({data.worked_pct}%)</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  data.worked_pct >= 60 ? "bg-green-500" :
                  data.worked_pct >= 30 ? "bg-yellow-500" : "bg-red-400"
                }`}
                style={{ width: `${data.worked_pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Lead list */}
        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {loading ? (
            <div className="space-y-2 py-4">
              {[1,2,3,4].map((i) => (
                <div key={i} className="h-10 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : leads.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No leads assigned to this rep</p>
          ) : (
            <>
              <div className="flex items-center gap-2 py-2 border-b border-gray-100">
                <input
                  type="checkbox"
                  id="select-all"
                  checked={selectAll}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="select-all" className="text-xs text-gray-500 select-none cursor-pointer">
                  Select all ({leads.length})
                </label>
                {selected.size > 0 && (
                  <span className="ml-auto text-xs font-medium text-blue-600">{selected.size} selected</span>
                )}
              </div>

              <div className="space-y-1 py-2">
                {leads.map((lead) => {
                  const isProtected = PROTECTED.includes(lead.status);
                  const ageDays = lead.assigned_at
                    ? Math.floor((Date.now() - new Date(lead.assigned_at).getTime()) / 86_400_000)
                    : null;
                  return (
                    <label
                      key={lead.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                        selected.has(lead.id) ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50 border border-transparent"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(lead.id)}
                        onChange={() => toggleLead(lead.id)}
                        className="rounded shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">
                          {lead.customer_name ? `${lead.customer_name} — ` : ""}{lead.address}
                        </p>
                        {ageDays != null && (
                          <p className="text-xs text-gray-400">Assigned {ageDays}d ago</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isProtected && (
                          <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">PROTECTED</span>
                        )}
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[lead.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABEL[lead.status] ?? lead.status}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 space-y-3">
          {error && <p className="text-xs text-red-600">{error}</p>}

          {selectedHasProtected && !warning && (
            <p className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
              Selection includes protected leads (appointment / sold / installed). You'll be asked to confirm.
            </p>
          )}

          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for pulling (optional)"
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />

          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={onClose} disabled={pulling}>Cancel</Button>
            <Button
              onClick={() => doPull(false)}
              disabled={pulling || leads.length === 0}
            >
              {pulling ? "Pulling…" : selected.size > 0 ? `Pull ${selected.size} Lead${selected.size !== 1 ? "s" : ""}` : "Pull All Eligible"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
