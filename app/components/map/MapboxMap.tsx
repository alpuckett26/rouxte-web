"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import * as turf from "@turf/turf";
import { Lead, LeadFilters } from "@/lib/types";
import CaptureLeadModal from "./CaptureLeadModal";
import { useProfile } from "@/lib/hooks/useProfile";

// Status → hex colour used in Mapbox paint expressions
const STATUS_HEX: Record<string, string> = {
  new: "#6b7280",
  attempted: "#f97316",
  contacted: "#3b82f6",
  qualified: "#a855f7",
  appointment_set: "#eab308",
  sold: "#22c55e",
  installed: "#16a34a",
  closed_lost: "#ef4444",
};

// Build a flat Mapbox match expression for status colours
function statusColorExpression(): mapboxgl.Expression {
  const pairs: (string | mapboxgl.Expression)[] = ["match", ["get", "status"]];
  for (const [status, hex] of Object.entries(STATUS_HEX)) {
    pairs.push(status, hex);
  }
  pairs.push("#6b7280"); // fallback
  return pairs as mapboxgl.Expression;
}

interface MapClickInfo {
  lat: number;
  lng: number;
  address?: string;
  attAvailable?: boolean | null; // null = FCC data not loaded yet / unavailable
}

interface Props {
  filters: LeadFilters;
  selectedLeadId: string | null;
  onSelectLead: (id: string | null) => void;
  onLeadCreated?: () => void;
}

export default function MapboxMap({
  filters,
  selectedLeadId,
  onSelectLead,
  onLeadCreated,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const drawRef = useRef<MapboxDraw | null>(null);

  const { profile } = useProfile();
  const isManager = profile?.role === "admin" || profile?.role === "sales_manager" || profile?.role === "team_lead";

  const [leads, setLeads] = useState<Lead[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [styleLoaded, setStyleLoaded] = useState(false);
  const [captureInfo, setCaptureInfo] = useState<MapClickInfo | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [mapStyle, setMapStyle] = useState<"streets" | "satellite">("streets");
  const [drawMode, setDrawMode] = useState(false);
  const [bulkLeads, setBulkLeads] = useState<Lead[]>([]);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [reps, setReps] = useState<{ user_id: string; full_name: string; role: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string; member_count: number }[]>([]);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkTab, setBulkTab] = useState<"team" | "rep">("team");

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  // ── Init map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!token || token === "pk.placeholder") return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-97.7431, 30.2672], // Austin TX default; will geolocate
      zoom: 12,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
      showAccuracyCircle: false,
    }), "top-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

    map.on("style.load", () => {
      if (!map.getSource("leads")) {
        addLeadsLayer(map);
      }
      setStyleLoaded(true);
    });

    // Click on a lead cluster → zoom in
    map.on("click", "leads-cluster", (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ["leads-cluster"] });
      if (!features.length) return;
      const clusterId = features[0].properties?.cluster_id;
      const source = map.getSource("leads") as mapboxgl.GeoJSONSource;
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || zoom == null) return;
        const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
        map.easeTo({ center: coords, zoom });
      });
    });

    // Click on an individual lead marker
    map.on("click", "leads-unclustered", (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const id = feature.properties?.id as string;
      onSelectLead(id);

      const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
      map.easeTo({ center: coords, offset: [150, 0] });
    });

    // Click on DNK marker
    map.on("click", "leads-dnk", (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      onSelectLead(feature.properties?.id as string);
    });

    // Right-click / long-press on empty map → FCC check + capture lead
    map.on("contextmenu", (e) => {
      handleMapClick(e.lngLat.lat, e.lngLat.lng, map);
    });

    // Long-press support for touch devices
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let touchMoved = false;

    const canvas = map.getCanvas();

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      touchMoved = false;
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const point = new mapboxgl.Point(
        touch.clientX - rect.left,
        touch.clientY - rect.top
      );
      const lngLat = map.unproject(point);
      longPressTimer = setTimeout(() => {
        if (!touchMoved) {
          handleMapClick(lngLat.lat, lngLat.lng, map);
        }
      }, 500);
    };

    const onTouchMove = () => {
      touchMoved = true;
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    };

    const onTouchEnd = () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    };

    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd, { passive: true });

    // Cursor changes
    for (const layer of ["leads-unclustered", "leads-cluster", "leads-dnk"]) {
      map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
    }

    // Draw control (added but hidden until manager activates)
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      modes: { ...MapboxDraw.modes },
    });
    map.addControl(draw as unknown as mapboxgl.IControl);
    drawRef.current = draw;

    mapRef.current = map;
    setMapReady(true);

    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      if (longPressTimer) clearTimeout(longPressTimer);
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
      setMapReady(false);
      setStyleLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Fetch reps + teams for bulk assign ────────────────────────────────────
  useEffect(() => {
    if (!isManager) return;
    fetch("/api/team/members")
      .then((r) => r.json())
      .then((d) => setReps(d.data ?? []));
    fetch("/api/manager/teams")
      .then((r) => r.json())
      .then((d) => setTeams(d.data ?? []));
  }, [isManager]);

  // ── Draw polygon → select leads ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !drawRef.current) return;

    const onDrawCreate = (e: { features: GeoJSON.Feature[] }) => {
      const polygon = e.features[0];
      if (!polygon) return;

      const inside = leads.filter((lead) => {
        if (lead.lat == null || lead.lng == null) return false;
        const pt = turf.point([lead.lng, lead.lat]);
        return turf.booleanPointInPolygon(pt, polygon as GeoJSON.Feature<GeoJSON.Polygon>);
      });

      drawRef.current?.deleteAll();
      setDrawMode(false);
      map.getCanvas().style.cursor = "";

      if (inside.length > 0) {
        setBulkLeads(inside);
        setBulkAssignOpen(true);
      }
    };

    map.on("draw.create", onDrawCreate);
    return () => { map.off("draw.create", onDrawCreate); };
  }, [leads]);

  function toggleDrawMode() {
    const map = mapRef.current;
    const draw = drawRef.current;
    if (!map || !draw) return;

    if (drawMode) {
      draw.changeMode("simple_select");
      draw.deleteAll();
      setDrawMode(false);
      map.getCanvas().style.cursor = "";
    } else {
      draw.changeMode("draw_polygon");
      setDrawMode(true);
      map.getCanvas().style.cursor = "crosshair";
    }
  }

  async function handleBulkAssign(opts: { assign_to?: string | null; team_id?: string }) {
    if (!bulkLeads.length) return;
    setBulkAssigning(true);
    await fetch("/api/leads/bulk-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_ids: bulkLeads.map((l) => l.id), ...opts }),
    });
    setBulkAssigning(false);
    setBulkAssignOpen(false);
    setBulkLeads([]);
    setBulkTab("team");
    fetchAndSyncLeads().then(syncLeadsToMap);
  }

  // ── Add GeoJSON layers ─────────────────────────────────────────────────────
  function addLeadsLayer(map: mapboxgl.Map) {
    map.addSource("leads", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 40,
    });

    // Cluster circles
    map.addLayer({
      id: "leads-cluster",
      type: "circle",
      source: "leads",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "step", ["get", "point_count"],
          "#3b82f6", 10, "#a855f7", 30, "#ef4444",
        ],
        "circle-radius": [
          "step", ["get", "point_count"],
          18, 10, 24, 30, 30,
        ],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });

    // Cluster count label
    map.addLayer({
      id: "leads-cluster-count",
      type: "symbol",
      source: "leads",
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-size": 12,
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
      },
      paint: { "text-color": "#ffffff" },
    });

    // Individual lead circles (non-DNK)
    map.addLayer({
      id: "leads-unclustered",
      type: "circle",
      source: "leads",
      filter: ["all", ["!", ["has", "point_count"]], ["!=", ["get", "is_do_not_knock"], true]],
      paint: {
        "circle-color": statusColorExpression(),
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          10, 5,
          14, 9,
          17, 12,
        ],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
        "circle-opacity": 0.9,
      },
    });

    // AT&T available indicator ring
    map.addLayer({
      id: "leads-att-ring",
      type: "circle",
      source: "leads",
      filter: ["all",
        ["!", ["has", "point_count"]],
        ["==", ["get", "att_available"], true],
        ["!=", ["get", "is_do_not_knock"], true],
      ],
      paint: {
        "circle-color": "transparent",
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          10, 8, 14, 14, 17, 18,
        ],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#22c55e",
        "circle-opacity": 0,
        "circle-stroke-opacity": 0.8,
      },
    });

    // DNK markers — red X
    map.addLayer({
      id: "leads-dnk",
      type: "symbol",
      source: "leads",
      filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "is_do_not_knock"], true]],
      layout: {
        "text-field": "✕",
        "text-size": 14,
        "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
      },
      paint: {
        "text-color": "#ef4444",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.5,
      },
    });
  }

  // ── Fetch leads and sync to map ────────────────────────────────────────────
  const fetchAndSyncLeads = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.carrier) params.set("carrier", filters.carrier);
    if (filters.status) params.set("status", filters.status);
    if (filters.tags?.length) params.set("tags", filters.tags.join(","));
    if (filters.is_do_not_knock !== undefined)
      params.set("is_do_not_knock", String(filters.is_do_not_knock));
    params.set("page_size", "200");

    try {
      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      const fetched: Lead[] = data.data ?? [];
      setLeads(fetched);
      return fetched;
    } catch {
      return [];
    }
  }, [filters]);

  // Sync fetched leads → Mapbox GeoJSON source
  const syncLeadsToMap = useCallback((fetched: Lead[]) => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("leads") as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: fetched.filter((lead) => lead.lat != null && lead.lng != null).map((lead) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lead.lng as number, lead.lat as number] },
        properties: {
          id: lead.id,
          status: lead.status,
          address: lead.address,
          is_do_not_knock: lead.is_do_not_knock,
          is_opt_out: lead.is_opt_out,
          att_available: lead.carrier_availability?.att ?? false,
          assigned_to: lead.assigned_to ?? null,
        },
      })),
    };

    source.setData(geojson);
  }, []);

  useEffect(() => {
    if (!styleLoaded) return;
    fetchAndSyncLeads().then(syncLeadsToMap);
  }, [filters, styleLoaded, fetchAndSyncLeads, syncLeadsToMap]);

  // Re-sync when a new lead is created
  useEffect(() => {
    if (!styleLoaded) return;
    fetchAndSyncLeads().then(syncLeadsToMap);
  }, [onLeadCreated, styleLoaded, fetchAndSyncLeads, syncLeadsToMap]);

  // ── Highlight selected lead ────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    if (selectedLeadId) {
      map.setPaintProperty("leads-unclustered", "circle-stroke-width", [
        "case",
        ["==", ["get", "id"], selectedLeadId], 4,
        2,
      ]);
      map.setPaintProperty("leads-unclustered", "circle-stroke-color", [
        "case",
        ["==", ["get", "id"], selectedLeadId], "#1d4ed8",
        "#ffffff",
      ]);
    } else {
      map.setPaintProperty("leads-unclustered", "circle-stroke-width", 2);
      map.setPaintProperty("leads-unclustered", "circle-stroke-color", "#ffffff");
    }
  }, [selectedLeadId, styleLoaded]);

  // ── Map style toggle ───────────────────────────────────────────────────────
  function toggleStyle() {
    const map = mapRef.current;
    if (!map) return;
    const next = mapStyle === "streets" ? "satellite" : "streets";
    setMapStyle(next);
    setStyleLoaded(false);
    map.setStyle(
      next === "satellite"
        ? "mapbox://styles/mapbox/satellite-streets-v12"
        : "mapbox://styles/mapbox/streets-v12"
    );
  }

  // ── Right-click → reverse geocode + FCC check → capture modal ───────────
  async function handleMapClick(lat: number, lng: number, map: mapboxgl.Map) {
    setGeocoding(true);

    // Run reverse geocode and FCC availability check in parallel
    const [address, attAvailable] = await Promise.all([
      // Reverse geocode
      (async () => {
        let addr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        if (token && token !== "pk.placeholder") {
          try {
            const geoRes = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=address&access_token=${token}`
            );
            const geoJson = await geoRes.json();
            addr = geoJson.features?.[0]?.place_name ?? addr;
          } catch { /* ignore */ }
        }
        return addr;
      })(),
      // FCC AT&T availability
      (async (): Promise<boolean | null> => {
        try {
          const res = await fetch(`/api/fcc/check?lat=${lat}&lng=${lng}`);
          const d = await res.json();
          return d.available ?? null;
        } catch {
          return null;
        }
      })(),
    ]);

    setGeocoding(false);
    setCaptureInfo({ lat, lng, address, attAvailable });

    // Add temporary marker
    new mapboxgl.Marker({ color: "#3b82f6" })
      .setLngLat([lng, lat])
      .addTo(map);
  }

  // ── No token state ─────────────────────────────────────────────────────────
  if (!token || token === "pk.placeholder") {
    return (
      <div className="relative w-full h-full bg-slate-100 flex flex-col items-center justify-center gap-4 rounded-2xl">
        <div className="absolute inset-0 opacity-10 pointer-events-none rounded-2xl"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg,#94a3b8 0,#94a3b8 1px,transparent 0,transparent 48px),
              repeating-linear-gradient(90deg,#94a3b8 0,#94a3b8 1px,transparent 0,transparent 48px)`,
          }}
        />
        <div className="relative z-10 text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center mx-auto mb-4">
            <svg className="h-7 w-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <p className="font-semibold text-gray-700 mb-1">Mapbox token required</p>
          <p className="text-sm text-gray-400 max-w-xs">
            Add <code className="bg-white rounded px-1 py-0.5 text-xs">NEXT_PUBLIC_MAPBOX_TOKEN</code> to{" "}
            <code className="bg-white rounded px-1 py-0.5 text-xs">.env.local</code> and restart the dev server.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Get a free token at <span className="text-blue-500">account.mapbox.com</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">
      {/* Map canvas */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Map controls overlay */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        {/* Draw / Select Area (managers only) */}
        {isManager && (
          <button
            onClick={toggleDrawMode}
            className={`flex items-center gap-1.5 rounded-xl backdrop-blur-sm border shadow-sm px-3 py-1.5 text-xs font-medium transition-colors ${
              drawMode
                ? "bg-blue-500 border-blue-600 text-white hover:bg-blue-600"
                : "bg-white/90 border-gray-200 text-gray-700 hover:bg-white"
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            {drawMode ? "Cancel" : "Select Area"}
          </button>
        )}

        {/* Style toggle */}
        <button
          onClick={toggleStyle}
          className="flex items-center gap-1.5 rounded-xl bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white transition-colors"
        >
          {mapStyle === "streets" ? (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
              </svg>
              Satellite
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Streets
            </>
          )}
        </button>

        {/* Map legend */}
        <div className="rounded-xl bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm px-3 py-2 text-xs text-gray-700">
          <p className="font-semibold mb-1.5 text-gray-900">Legend</p>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-3 h-3 rounded-full border-2 border-green-500 bg-transparent inline-block" />
            AT&T available
          </div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-3 h-3 rounded-full bg-gray-400 inline-block" />
            No AT&T
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-red-500 font-bold text-xs leading-none">✕</span>
            Do Not Knock
          </div>
        </div>
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <div className="rounded-full bg-white/80 backdrop-blur-sm border border-gray-200 shadow-sm px-4 py-1.5 text-xs text-gray-500">
          {geocoding
            ? "Looking up address & checking FCC coverage…"
            : drawMode
            ? "Click to draw polygon — click first point to close"
            : <><span className="hidden sm:inline">Right-click</span><span className="sm:hidden">Long-press</span> any point to capture a lead</>
          }
        </div>
      </div>

      {/* Capture lead modal */}
      {captureInfo && (
        <CaptureLeadModal
          info={captureInfo}
          onClose={() => setCaptureInfo(null)}
          onCreated={() => {
            setCaptureInfo(null);
            fetchAndSyncLeads().then(syncLeadsToMap);
            onLeadCreated?.();
          }}
        />
      )}

      {/* Bulk assign modal */}
      {bulkAssignOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 flex flex-col max-h-[80vh]">
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-base font-semibold text-gray-900">Assign Selected Leads</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {bulkLeads.length} lead{bulkLeads.length !== 1 ? "s" : ""} selected
              </p>
            </div>

            {/* Tabs */}
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

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {bulkTab === "team" ? (
                <div className="flex flex-col gap-2">
                  {teams.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">No teams yet. Create a team first.</p>
                  )}
                  {teams.map((team) => (
                    <button
                      key={team.id}
                      disabled={bulkAssigning || team.member_count === 0}
                      onClick={() => handleBulkAssign({ team_id: team.id })}
                      className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 hover:bg-blue-50 hover:border-blue-200 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{team.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {team.member_count} rep{team.member_count !== 1 ? "s" : ""} · leads split evenly
                        </p>
                      </div>
                      <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {reps.filter((r) => r.role === "sales_rep" || r.role === "team_lead").map((rep) => (
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
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => { setBulkAssignOpen(false); setBulkLeads([]); setBulkTab("team"); }}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status legend */}
      <div className="absolute bottom-12 right-3 z-10 hidden md:block">
        <div className="rounded-xl bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm px-3 py-2 text-xs text-gray-700">
          <p className="font-semibold mb-1.5 text-gray-900">Lead Status</p>
          {Object.entries(STATUS_HEX)
            .filter(([s]) => s !== "closed_lost")
            .map(([status, hex]) => (
              <div key={status} className="flex items-center gap-1.5 mb-0.5 capitalize">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: hex }} />
                {status.replace("_", " ")}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
