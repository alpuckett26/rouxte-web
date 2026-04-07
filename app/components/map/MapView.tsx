"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import LeadFilterBar from "./LeadFilterBar";
import LeadListPanel from "./LeadListPanel";
import { LeadFilters } from "@/lib/types";

const ARView = dynamic(() => import("./ARView"), { ssr: false });

const MapboxMap = dynamic(() => import("./MapboxMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 animate-pulse flex items-center justify-center">
      <span className="text-sm text-gray-400">Loading map…</span>
    </div>
  ),
});

const FullscreenEnterIcon = () => (
  <svg className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
  </svg>
);

const FullscreenExitIcon = () => (
  <svg className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
  </svg>
);

export default function MapView() {
  const [filters, setFilters] = useState<LeadFilters>({});
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [arOpen, setArOpen] = useState(false);
  const [leadsOpen, setLeadsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const mapCanvas = (
    <MapboxMap
      filters={filters}
      selectedLeadId={selectedLeadId}
      onSelectLead={setSelectedLeadId}
      onLeadCreated={() => setRefreshKey((k) => k + 1)}
    />
  );

  return (
    <>
      {arOpen && <ARView onClose={() => setArOpen(false)} />}

      {/* ── MOBILE (< md) ───────────────────────────────────────── */}
      <div className="md:hidden h-full flex flex-col relative">
        {/* Compact top bar */}
        {!fullscreen && (
          <>
            <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-100">
              <button
                onClick={() => setFilterOpen((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  filterOpen ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-700"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                </svg>
                Filter
              </button>

              <div className="flex-1" />

              <button
                onClick={() => setLeadsOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700"
              >
                Leads
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>

              <button
                onClick={() => setArOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
                AR
              </button>
            </div>

            {filterOpen && (
              <div className="shrink-0 px-3 py-2 bg-white border-b border-gray-100 overflow-x-auto">
                <LeadFilterBar filters={filters} onChange={setFilters} />
              </div>
            )}
          </>
        )}

        {/* Map — fills remaining space */}
        <div className="flex-1 min-h-0 relative">
          {mapCanvas}

          {/* Fullscreen toggle */}
          <button
            onClick={() => setFullscreen((v) => !v)}
            className="absolute bottom-4 right-4 z-10 flex items-center justify-center w-10 h-10 rounded-xl bg-white shadow-lg border border-gray-200"
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {fullscreen ? <FullscreenExitIcon /> : <FullscreenEnterIcon />}
          </button>
        </div>

        {/* Leads bottom sheet */}
        {leadsOpen && (
          <div className="absolute inset-0 z-30 flex flex-col justify-end">
            <button
              className="flex-1 bg-black/30"
              onClick={() => setLeadsOpen(false)}
              aria-label="Close leads"
            />
            <div className="bg-white rounded-t-2xl max-h-[65vh] flex flex-col shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
                <span className="font-semibold text-gray-900">Leads</span>
                <button
                  onClick={() => setLeadsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-3">
                <LeadListPanel
                  key={refreshKey}
                  filters={filters}
                  selectedLeadId={selectedLeadId}
                  onSelectLead={(id) => {
                    setSelectedLeadId(id);
                    setLeadsOpen(false);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Fullscreen overlay — escapes AppShell entirely */}
        {fullscreen && (
          <div className="fixed inset-0 z-[100] flex flex-col bg-black">
            <div className="flex-1 relative">
              {mapCanvas}
              <button
                onClick={() => setFullscreen(false)}
                className="absolute bottom-4 right-4 z-10 flex items-center justify-center w-10 h-10 rounded-xl bg-white shadow-lg border border-gray-200"
                aria-label="Exit fullscreen"
              >
                <FullscreenExitIcon />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── DESKTOP (md+) ───────────────────────────────────────── */}
      <div className="hidden md:flex flex-col gap-4 h-full">
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Field Map</h1>
            <p className="text-sm text-gray-500">FCC broadband overlay + lead discovery</p>
          </div>
          <button
            onClick={() => setArOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-700 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            AR View
          </button>
        </div>

        <div className="shrink-0">
          <LeadFilterBar filters={filters} onChange={setFilters} />
        </div>

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Map canvas */}
          <div className="flex-1 rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative">
            {mapCanvas}
            <button
              onClick={() => setFullscreen((v) => !v)}
              className="absolute bottom-4 right-4 z-10 flex items-center justify-center w-10 h-10 rounded-xl bg-white shadow-lg border border-gray-200"
              aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {fullscreen ? <FullscreenExitIcon /> : <FullscreenEnterIcon />}
            </button>
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

        {/* Desktop fullscreen overlay */}
        {fullscreen && (
          <div className="fixed inset-0 z-[100] flex flex-col bg-black">
            <div className="flex-1 relative">
              {mapCanvas}
              <button
                onClick={() => setFullscreen(false)}
                className="absolute bottom-4 right-4 z-10 flex items-center justify-center w-10 h-10 rounded-xl bg-white shadow-lg border border-gray-200"
                aria-label="Exit fullscreen"
              >
                <FullscreenExitIcon />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
