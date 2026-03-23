"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lead, LeadFilters } from "@/lib/types";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from "@/lib/utils/leads";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import LeadFilterBar from "@/components/map/LeadFilterBar";

export default function LeadsListPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<LeadFilters>({});

  useEffect(() => {
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500">Your pipeline at a glance</p>
        </div>
        <Link href="/leads/new">
          <Button size="sm">+ Add Lead</Button>
        </Link>
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
          <p className="text-gray-500">No leads yet. Head to the map to discover addresses.</p>
          <Link href="/map" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            Open Map
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="px-4 py-3 text-left font-medium">Address</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">AT&T</th>
                <th className="px-4 py-3 text-left font-medium">Assigned</th>
                <th className="px-4 py-3 text-left font-medium">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">
                    {lead.address}
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
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {lead.assigned_to ? "Assigned" : "Unassigned"}
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
    </div>
  );
}
