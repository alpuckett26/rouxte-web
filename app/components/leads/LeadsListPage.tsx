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

interface Rep { user_id: string; full_name: string }

export default function LeadsListPage() {
  const { profile } = useProfile();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<LeadFilters>({});
  const [importOpen, setImportOpen] = useState(false);
  const [reps, setReps] = useState<Rep[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);

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
      .then((d) => setReps((d.data ?? []).filter((m: Rep & { role: string }) => m.role === "sales_rep")));
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
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
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
                <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
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
                        {reps.map((r) => (
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
                    <Link
                      href={`/leads/${lead.id}`}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LeadImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(count) => {
          setImportOpen(false);
          fetchLeads();
          console.log(`Imported ${count} leads`);
        }}
      />
    </div>
  );
}
