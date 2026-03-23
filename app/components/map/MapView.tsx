"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import LeadFilterBar from "./LeadFilterBar";
import LeadListPanel from "./LeadListPanel";
import { LeadFilters } from "@/lib/types";

// Dynamic import keeps mapbox-gl out of the SSR bundle
const MapboxMap = dynamic(() => import("./MapboxMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full rounded-2xl bg-slate-100 animate-pulse flex items-center justify-center">
      <span className="text-sm text-gray-400">Loading map…</span>
    </div>
  ),
});

export default function MapView() {
  const [filters, setFilters] = useState<LeadFilters>({});
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Field Map</h1>
          <p className="text-sm text-gray-500">FCC broadband overlay + lead discovery</p>
        </div>
      </div>

      <LeadFilterBar filters={filters} onChange={setFilters} />

      <div className="flex gap-4 h-[calc(100vh-220px)]">
        {/* Map canvas */}
        <div className="flex-1 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
          <MapboxMap
            filters={filters}
            selectedLeadId={selectedLeadId}
            onSelectLead={setSelectedLeadId}
            onLeadCreated={() => setRefreshKey((k) => k + 1)}
          />
        </div>

        {/* Lead list sidebar */}
        <div className="w-80 shrink-0 overflow-y-auto">
          <LeadListPanel
            key={refreshKey}
            filters={filters}
            selectedLeadId={selectedLeadId}
            onSelectLead={setSelectedLeadId}
          />
        </div>
      </div>
    </div>
  );
}
