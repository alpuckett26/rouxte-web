"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Lead, LeadFilters } from "@/lib/types";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from "@/lib/utils/leads";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import LeadFilterBar from "@/components/map/LeadFilterBar";
import LeadImportModal from "@/components/leads/LeadImportModal";
import { useProfile } from "@/lib/hooks/useProfile";

interface Rep { user_id: string; full_name: string; role: string }
interface Team { id: string; name: string; member_count: number }

export default function LeadsListPage() {
  const { profile } = useProfile();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<LeadFilters>({});
  const [importOpen, setImportOpen] = useState(false);
  const [reps, setReps] = useState<Rep[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkTab, setBulkTab] = useState<"team" | "rep">("team");
  const [bulkAssigning, setBulkAssigning] = useState(false);

  const isManager = profile?.role === "admin" || profile?.role === "sales_manager" || profile?.role === "team_lead";

  const fetchLeads = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.carrier) params.set("carrier", filters.carrier);
    if (filters.status) params.set("status", filters.status);
    if (filters.tags?.length) params.set("tags", filters.tags.join(","));

    setLoading(true);
    fetch(`/api/leads?${params}`)
      .then((r) => r.json())
      .then((d) => setLeads(d.data ?? []))
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    if (!isManager) return;
    fetch("/api/team/members")
      .then((r) => r.json())
      .then((d) => setReps(d.data ?? []));
    fetch("/api/manager/teams")
      .then((r) => r.json())
      .then((d) => setTeams(d.data ?? []));
  }, [isManager]);

  async function assignLead(leadId: string, userId: string | null) {
    setAssigning(leadId);
    await fetch(`/api/leads/${leadId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assign_to: userId }),
    });
    await fetchLeads();
    setAssigning(null);
  }

  async function handleBulkAssign(opts: { assign_to?: string | null; team_id?: string }) {
    if (!selected.size) return;
    setBulkAssigning(true);
    await fetch("/api/leads/bulk-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_ids: [...selected], ...opts }),
    });
    setBulkAssigning(false);
    setBulkOpen(false);
    setSelected(new Set());
    setBulkTab("team");
    fetchLeads();
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === leads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(leads.map((l) => l.id)));
    }
  }

  const repName = (userId: string | null) => {
    if (!userId) return null;
    return reps.find((r) => r.user_id === userId)?.full_name ?? "Assigned";
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500">Your pipeline at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
              Import
            </Button>
          )}
          <Link href="/leads/new">
            <Button size="sm">+ Add Lead</Button>
          </Link>
        </div>
      </div>

      <LeadFilterBar filters={filters} onChange={setFilters} />

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : !leads.length ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <p className="text-gray-500">No leads yet.</p>
          {isManager ? (
            <button
              onClick={() => setImportOpen(true)}
              className="mt-4 inline-block text-sm text-blue-600 hover:underline"
            >
              Import from spreadsheet
            </button>
          ) : (
            <Link href="/map" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
              Open Map
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Bulk action bar */}
          {isManager && selected.size > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5">
              <span className="text-sm text-blue-700 font-medium">
                {selected.size} lead{selected.size !== 1 ? "s" : ""} selected
              </span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setBulkOpen(true)}>Assign</Button>
                <button onClick={() => setSelected(new Set())} className="text-xs text-blue-500 hover:text-blue-700">Clear</button>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  {isManager && (
                    <th className="pl-4 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={selected.size === leads.length && leads.length > 0}
                        onChange={toggleAll}
                        className="rounded"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left font-medium">Address / Customer</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">AT&T</th>
                  <th className="px-4 py-3 text-left font-medium">Assigned To</th>
                  <th className="px-4 py-3 text-left font-medium">Updated</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leads.map((lead) => (
                  <tr key={lead.id} className={`hover:bg-gray-50 transition-colors ${selected.has(lead.id) ? "bg-blue-50/50" : ""}`}>
                    {isManager && (
                      <td className="pl-4 py-3 w-8">
                        <input
                          type="checkbox"
                          checked={selected.has(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          className="rounded"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium text-gray-900 truncate">{lead.address}</p>
                      {lead.customer_name && (
                        <p className="text-xs text-gray-400 truncate">{lead.customer_name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={LEAD_STATUS_LABELS[lead.status]}
                        color={LEAD_STATUS_COLORS[lead.status]}
                        dot
                      />
                    </td>
                    <td className="px-4 py-3">
                      {lead.carrier_availability?.att ? (
                        <span className="text-green-600 font-medium text-xs">Yes</span>
                      ) : (
                        <span className="text-gray-400 text-xs">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isManager ? (
                        <select
                          value={lead.assigned_to ?? ""}
                          disabled={assigning === lead.id}
                          onChange={(e) => assignLead(lead.id, e.target.value || null)}
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50 max-w-[140px]"
                        >
                          <option value="">Unassigned</option>
                          {reps.filter((r) => r.role === "sales_rep" || r.role === "team_lead").map((r) => (
                            <option key={r.user_id} value={r.user_id}>{r.full_name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-500">
                          {repName(lead.assigned_to) ?? "Unassigned"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(lead.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/leads/${lead.id}`} className="text-blue-600 hover:underline text-xs">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <LeadImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => { setImportOpen(false); fetchLeads(); }}
      />

      {/* Bulk assign modal */}
      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col max-h-[80vh]">
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-base font-semibold text-gray-900">Assign Selected Leads</h3>
              <p className="text-sm text-gray-500 mt-0.5">{selected.size} lead{selected.size !== 1 ? "s" : ""} selected</p>
            </div>

            <div className="flex border-b border-gray-100 px-6">
              {(["team", "rep"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setBulkTab(t)}
                  className={`py-2.5 px-3 text-xs font-medium border-b-2 transition-colors ${
                    bulkTab === t ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500"
                  }`}
                >
                  {t === "team" ? "Distribute to Team" : "Assign to Rep"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">
              {bulkTab === "team" ? (
                teams.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No teams yet.</p>
                ) : teams.map((team) => (
                  <button
                    key={team.id}
                    disabled={bulkAssigning || team.member_count === 0}
                    onClick={() => handleBulkAssign({ team_id: team.id })}
                    className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 hover:bg-blue-50 hover:border-blue-200 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{team.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {team.member_count} rep{team.member_count !== 1 ? "s" : ""} · split evenly
                      </p>
                    </div>
                    <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))
              ) : (
                reps.filter((r) => r.role === "sales_rep" || r.role === "team_lead").map((rep) => (
                  <button
                    key={rep.user_id}
                    disabled={bulkAssigning}
                    onClick={() => handleBulkAssign({ assign_to: rep.user_id })}
                    className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 hover:bg-blue-50 hover:border-blue-200 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-blue-700">{rep.full_name.charAt(0)}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{rep.full_name}</span>
                  </button>
                ))
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => { setBulkOpen(false); setBulkTab("team"); }}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
