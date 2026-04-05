"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import LeadFilterBar from "./LeadFilterBar";
import LeadListPanel from "./LeadListPanel";
import { LeadFilters } from "@/lib/types";

const ARView = dynamic(() => import("./ARView"), { ssr: false });

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
  const [arOpen, setArOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {arOpen && <ARView onClose={() => setArOpen(false)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Field Map</h1>
          <p className="text-sm text-gray-500">FCC broadband overlay + lead discovery</p>
        </div>
        <button
          onClick={() => setArOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-700 transition-colors"
        >
          {/* Camera icon */}
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
          AR View
        </button>
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
