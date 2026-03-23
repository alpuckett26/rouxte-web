"use client";

import { LeadFilters } from "@/lib/types";

interface Props {
  selectedLeadId: string | null;
  onSelectLead: (id: string) => void;
  filters: LeadFilters;
}

export default function MapPlaceholder({ onSelectLead }: Props) {
  // Placeholder until map tile provider is configured
  // Replace this component body with a Mapbox/Leaflet/Google Maps integration
  return (
    <div className="relative w-full h-full bg-slate-100 flex flex-col items-center justify-center gap-4">
      {/* Simulated map tiles */}
      <div className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, #94a3b8 0, #94a3b8 1px, transparent 0, transparent 50%),
            repeating-linear-gradient(90deg, #94a3b8 0, #94a3b8 1px, transparent 0, transparent 50%)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center mx-auto mb-4">
          <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <p className="font-semibold text-gray-700">Map view</p>
        <p className="text-sm text-gray-400 mt-1 max-w-xs">
          Connect a Mapbox or Google Maps API key to enable the interactive FCC broadband overlay.
        </p>
        <p className="text-xs text-gray-400 mt-3">
          Set <code className="bg-white rounded px-1 py-0.5">NEXT_PUBLIC_MAPBOX_TOKEN</code> in .env.local
        </p>
      </div>

      {/* Demo pins */}
      {[
        { x: "25%", y: "35%", color: "bg-green-500" },
        { x: "45%", y: "55%", color: "bg-yellow-500" },
        { x: "65%", y: "30%", color: "bg-blue-500" },
        { x: "70%", y: "60%", color: "bg-red-500" },
        { x: "30%", y: "65%", color: "bg-green-500" },
      ].map((pin, i) => (
        <button
          key={i}
          onClick={() => onSelectLead(`demo-${i}`)}
          className={`absolute w-4 h-4 rounded-full ${pin.color} border-2 border-white shadow-md hover:scale-125 transition-transform`}
          style={{ left: pin.x, top: pin.y }}
        />
      ))}
    </div>
  );
}
