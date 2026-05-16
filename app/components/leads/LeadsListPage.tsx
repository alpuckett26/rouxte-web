"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lead, LeadFilters } from "@/lib/types";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from "@/lib/utils/leads";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import LeadFilterBar from "@/components/map/LeadFilterBar";
import LeadImportModal from "@/components/leads/LeadImportModal";
import { useProfile } from "@/lib/hooks/useProfile";

type QuickFilter = null | "today" | "hot" | "stale" | "unassigned";

const STALE_DAYS_HOT = 3;   // interested + no follow-up 3d+
const STALE_DAYS_GEN = 7;   // any status, 7d+ since update

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

function isAppointmentToday(lead: Lead): boolean {
  if (!lead.appointment_at) return lead.status === "appointment";
  const d = new Date(lead.appointment_at);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

interface Rep  { user_id: string; full_name: string; role: string; assigned_leads?: number }
interface Team { id: string; name: string; member_count: number }

const PAGE_SIZE = 100;

export default function LeadsListPage() {
  const { profile } = useProfile();
  const searchParams = useSearchParams();
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<LeadFilters>(() => {
    const assignedTo = searchParams.get("assigned_to");
    return assignedTo ? { assigned_to: assignedTo } : {};
  });
  const [importOpen, setImportOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);
  const [reps, setReps]   = useState<Rep[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen]   = useState(false);
  const [bulkTab, setBulkTab]     = useState<"team" | "rep" | "unassign">("team");
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [selectMode, setSelectMode] = useState<"page" | "all">("page");

  const isManager = profile?.role === "admin" || profile?.role === "sales_manager" || profile?.role === "team_lead";
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchLeads = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.carrier)     params.set("carrier", filters.carrier);
    if (filters.status)      params.set("status", filters.status);
    if (filters.tags?.length) params.set("tags", filters.tags.join(","));
    if (filters.assigned_to) params.set("assigned_to", filters.assigned_to);
    params.set("page", String(page));
    params.set("page_size", String(PAGE_SIZE));

    setLoading(true);
    fetch(`/api/leads?${params}`)
      .then((r) => r.json())
      .then((d) => { setLeads(d.data ?? []); setTotal(d.total ?? 0); })
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { setPage(1); setSelected(new Set()); }, [filters]);

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

    // If selectMode === "all", send a special flag to assign all matching leads
    const body = selectMode === "all"
      ? { ...opts, select_all: true, filters }
      : { lead_ids: [...selected], ...opts };

    await fetch("/api/leads/bulk-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBulkAssigning(false);
    setBulkOpen(false);
    setSelected(new Set());
    setSelectMode("page");
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

  function togglePage() {
    const target = quickFilter ? visibleLeads : leads;
    const allOnPage = target.every((l) => selected.has(l.id));
    if (allOnPage) {
      setSelected(new Set());
      setSelectMode("page");
    } else {
      setSelected(new Set(target.map((l) => l.id)));
    }
  }

  const repName = (userId: string | null) => {
    if (!userId) return null;
    return reps.find((r) => r.user_id === userId)?.full_name ?? "Assigned";
  };

  const repsList = reps.filter((r) => r.role === "sales_rep" || r.role === "team_lead");

  // Quick-filter chip applies client-side over the loaded page
  const visibleLeads = useMemo(() => {
    if (!quickFilter) return leads;
    if (quickFilter === "today")      return leads.filter(isAppointmentToday);
    if (quickFilter === "unassigned") return leads.filter((l) => !l.assigned_to);
    if (quickFilter === "stale")      return leads.filter((l) => daysSince(l.updated_at) >= STALE_DAYS_GEN && !["sold", "lost"].includes(l.status));
    if (quickFilter === "hot")        return leads.filter((l) => l.status === "interested" && daysSince(l.updated_at) >= STALE_DAYS_HOT);
    return leads;
  }, [leads, quickFilter]);

  // Stats for bulk assignment preview
  const selectedLeads = leads.filter((l) => selected.has(l.id));
  const unassignedCount = selectedLeads.filter((l) => !l.assigned_to).length;
  const assignedCount   = selectedLeads.filter((l) => l.assigned_to).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500">
            {total > 0 ? `${total.toLocaleString()} total` : "Your pipeline"}
          </p>
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

      {/* Quick filter chips — apply client-side over the loaded page */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
        <FilterChip label="Today's appointments" active={quickFilter === "today"}      onClick={() => setQuickFilter(quickFilter === "today" ? null : "today")} />
        <FilterChip label="Hot"                  active={quickFilter === "hot"}        onClick={() => setQuickFilter(quickFilter === "hot" ? null : "hot")} />
        <FilterChip label="Stale 7d+"            active={quickFilter === "stale"}      onClick={() => setQuickFilter(quickFilter === "stale" ? null : "stale")} />
        <FilterChip label="Unassigned"           active={quickFilter === "unassigned"} onClick={() => setQuickFilter(quickFilter === "unassigned" ? null : "unassigned")} />
      </div>

      <LeadFilterBar filters={filters} onChange={setFilters} />

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : !visibleLeads.length ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <p className="text-gray-500">
            {quickFilter ? "No leads match this filter." : "No leads yet."}
          </p>
          {isManager ? (
            <button onClick={() => setImportOpen(true)} className="mt-4 inline-block text-sm text-blue-600 hover:underline">
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
            <div className="flex flex-col gap-1 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-blue-700 font-medium">
                    {selectMode === "all" ? `All ${total.toLocaleString()} leads selected` : `${selected.size} lead${selected.size !== 1 ? "s" : ""} selected`}
                  </span>
                  {selectMode === "page" && total > PAGE_SIZE && (
                    <button
                      onClick={() => setSelectMode("all")}
                      className="text-xs text-blue-600 underline hover:text-blue-800"
                    >
                      Select all {total.toLocaleString()} leads
                    </button>
                  )}
                  {selectMode === "all" && (
                    <button
                      onClick={() => { setSelectMode("page"); setSelected(new Set(leads.map((l) => l.id))); }}
                      className="text-xs text-blue-600 underline hover:text-blue-800"
                    >
                      Select this page only
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setBulkOpen(true)}>Assign</Button>
                  <button onClick={() => { setSelected(new Set()); setSelectMode("page"); }} className="text-xs text-blue-500 hover:text-blue-700">Clear</button>
                </div>
              </div>
              {selectMode === "page" && (unassignedCount > 0 || assignedCount > 0) && (
                <p className="text-xs text-blue-600">
                  {unassignedCount > 0 && `${unassignedCount} unassigned`}
                  {unassignedCount > 0 && assignedCount > 0 && " · "}
                  {assignedCount > 0 && `${assignedCount} already assigned`}
                </p>
              )}
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
                        checked={visibleLeads.length > 0 && visibleLeads.every((l) => selected.has(l.id))}
                        onChange={togglePage}
                        className="rounded"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left font-medium">Address / Customer</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Service</th>
                  <th className="px-4 py-3 text-left font-medium">Assigned To</th>
                  <th className="px-4 py-3 text-left font-medium">Updated</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visibleLeads.map((lead) => (
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
                      <Badge label={LEAD_STATUS_LABELS[lead.status]} color={LEAD_STATUS_COLORS[lead.status]} dot />
                    </td>
                    <td className="px-4 py-3">
                      {lead.carrier_availability?.att ? (
                        <span className="text-green-600 font-medium text-xs">Available</span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
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
                          {repsList.map((r) => (
                            <option key={r.user_id} value={r.user_id}>{r.full_name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-500">{repName(lead.assigned_to) ?? "Unassigned"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(lead.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/leads/${lead.id}`} className="text-blue-600 hover:underline text-xs">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-gray-400">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                  // Show pages around current
                  let p: number;
                  if (totalPages <= 7) p = i + 1;
                  else if (page <= 4) p = i + 1;
                  else if (page >= totalPages - 3) p = totalPages - 6 + i;
                  else p = page - 3 + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                        p === page ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[85vh]">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Assign Leads</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {selectMode === "all"
                  ? `All ${total.toLocaleString()} leads`
                  : `${selected.size} lead${selected.size !== 1 ? "s" : ""} selected`}
                {selectMode === "page" && unassignedCount > 0 && (
                  <span className="text-amber-600"> · {unassignedCount} unassigned</span>
                )}
              </p>
            </div>

            <div className="flex border-b border-gray-100 px-6">
              {([
                { key: "team",     label: "Distribute to Team" },
                { key: "rep",      label: "Assign to Rep" },
                { key: "unassign", label: "Unassign" },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setBulkTab(t.key)}
                  className={`py-2.5 px-3 text-xs font-medium border-b-2 transition-colors ${
                    bulkTab === t.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">
              {bulkTab === "team" && (
                <>
                  <p className="text-xs text-gray-400 mb-1">Leads will be distributed evenly across active reps on the selected team, balancing existing workloads.</p>
                  {teams.length === 0 ? (
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
                          {team.member_count} rep{team.member_count !== 1 ? "s" : ""} · split by workload
                        </p>
                      </div>
                      {bulkAssigning ? (
                        <span className="text-xs text-blue-500">Assigning…</span>
                      ) : (
                        <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </>
              )}

              {bulkTab === "rep" && (
                <>
                  <p className="text-xs text-gray-400 mb-1">All selected leads will be assigned to one rep.</p>
                  {repsList.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No reps found.</p>
                  ) : repsList.map((rep) => (
                    <button
                      key={rep.user_id}
                      disabled={bulkAssigning}
                      onClick={() => handleBulkAssign({ assign_to: rep.user_id })}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 hover:bg-blue-50 hover:border-blue-200 transition-colors text-left disabled:opacity-50"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-blue-700">{rep.full_name.charAt(0)}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{rep.full_name}</p>
                        {rep.assigned_leads != null && (
                          <p className="text-xs text-gray-400">{rep.assigned_leads} leads currently assigned</p>
                        )}
                      </div>
                      {bulkAssigning && <span className="text-xs text-blue-500">…</span>}
                    </button>
                  ))}
                </>
              )}

              {bulkTab === "unassign" && (
                <div className="flex flex-col items-center gap-4 py-6 text-center">
                  <p className="text-sm text-gray-600">
                    Remove rep assignment from {selectMode === "all" ? `all ${total.toLocaleString()}` : selected.size} leads.
                    {selectMode === "page" && assignedCount === 0 && (
                      <span className="block text-gray-400 text-xs mt-1">All selected leads are already unassigned.</span>
                    )}
                  </p>
                  <button
                    disabled={bulkAssigning || (selectMode === "page" && assignedCount === 0)}
                    onClick={() => handleBulkAssign({ assign_to: null })}
                    className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-6 py-2.5 hover:bg-red-100 transition-colors disabled:opacity-40"
                  >
                    {bulkAssigning ? "Unassigning…" : "Unassign Selected"}
                  </button>
                </div>
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

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "border-blue-500 bg-blue-50 text-blue-700"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
