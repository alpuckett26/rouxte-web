"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lead, LeadFilters } from "@/lib/types";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from "@/lib/utils/leads";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";

interface Props {
  filters: LeadFilters;
  selectedLeadId: string | null;
  onSelectLead: (id: string) => void;
}

export default function LeadListPanel({ filters, selectedLeadId, onSelectLead }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.carrier) params.set("carrier", filters.carrier);
    if (filters.status) params.set("status", filters.status);
    if (filters.tags?.length) params.set("tags", filters.tags.join(","));
    if (filters.is_do_not_knock !== undefined)
      params.set("is_do_not_knock", String(filters.is_do_not_knock));

    setLoading(true);
    fetch(`/api/leads?${params}`)
      .then((r) => r.json())
      .then((d) => setLeads(d.data ?? []))
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, [filters]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!leads.length) {
    return (
      <Card>
        <p className="text-sm text-gray-500 text-center py-4">No leads match your filters.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-gray-500 px-1">{leads.length} leads</p>
      {leads.map((lead) => (
        <button
          key={lead.id}
          onClick={() => onSelectLead(lead.id)}
          className={`w-full text-left rounded-2xl border transition-all ${
            selectedLeadId === lead.id
              ? "border-blue-400 bg-blue-50 shadow-md"
              : "border-gray-100 bg-white shadow-sm hover:border-gray-200 hover:shadow-md"
          }`}
        >
          <div className="p-3">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <p className="text-sm font-medium text-gray-900 leading-snug line-clamp-2">
                {lead.address}
              </p>
              <Badge
                label={LEAD_STATUS_LABELS[lead.status]}
                color={LEAD_STATUS_COLORS[lead.status]}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {lead.carrier_availability?.att && (
                <span className="text-green-600 font-medium">AT&T avail.</span>
              )}
              {lead.is_do_not_knock && (
                <span className="text-red-600 font-medium">DNK</span>
              )}
            </div>
            <Link
              href={`/leads/${lead.id}`}
              onClick={(e) => e.stopPropagation()}
              className="mt-2 text-xs text-blue-600 hover:underline"
            >
              View details
            </Link>
          </div>
        </button>
      ))}
    </div>
  );
}
