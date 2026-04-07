"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import mapboxgl from "mapbox-gl";
import { Lead, LeadFilters } from "@/lib/types";
import CaptureLeadModal from "./CaptureLeadModal";
import QuickLogSheet from "./QuickLogSheet";
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
  const selectionCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const dragCurrent = useRef<{ x: number; y: number } | null>(null);

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
  const [bulkTab, setBulkTab] = useState<"lead" | "team" | "rep">("lead");
  const [dnkWarning, setDnkWarning] = useState<string | null>(null);
  const dnkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Quick-log sheet (Spotio)
  const [quickLogLead, setQuickLogLead] = useState<Lead | null>(null);

  // Knock counter
  const [knockCount, setKnockCount] = useState(0);

  // Field mode (Badger)
  const [fieldMode, setFieldMode] = useState(false);

  // Rep location dots (manager map)
  interface RepLocation { user_id: string; lat: number; lng: number; full_name: string; initials: string; role: string; updated_at: string; }
  const [repLocations, setRepLocations] = useState<RepLocation[]>([]);
  const repMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    const onStyleLoad = () => {
      if (!map.getSource("leads")) {
        addLeadsLayer(map);
      }
      setStyleLoaded(true);
    };
    map.on("style.load", onStyleLoad);
    // Fallback: if style already loaded by the time listener attaches
    if (map.isStyleLoaded()) onStyleLoad();

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

    // Click on an individual lead marker → show QuickLogSheet
    map.on("click", "leads-unclustered", (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const id = feature.properties?.id as string;
      const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
      map.easeTo({ center: coords, offset: [0, -80] });
      // Find lead in state and show quick-log sheet
      setLeads((prev) => {
        const lead = prev.find((l) => l.id === id);
        if (lead) setQuickLogLead(lead);
        return prev;
      });
    });

    // Click on DNK marker — warning + quick-log sheet
    map.on("click", "leads-dnk", (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const address = feature.properties?.address as string | undefined;
      setDnkWarning(address ?? "This address");
      if (dnkTimerRef.current) clearTimeout(dnkTimerRef.current);
      dnkTimerRef.current = setTimeout(() => setDnkWarning(null), 5000);
      const id = feature.properties?.id as string;
      setLeads((prev) => {
        const lead = prev.find((l) => l.id === id);
        if (lead) setQuickLogLead(lead);
        return prev;
      });
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

    mapRef.current = map;
    setMapReady(true);

    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      if (longPressTimer) clearTimeout(longPressTimer);
      map.remove();
      mapRef.current = null;
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

  // ── Rep GPS location reporting (reps only) ────────────────────────────────
  useEffect(() => {
    if (!mapReady || isManager || !navigator.geolocation) return;
    function sendLocation() {
      navigator.geolocation.getCurrentPosition((pos) => {
        fetch("/api/rep/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        }).catch(() => {});
      }, () => {});
    }
    sendLocation();
    locationIntervalRef.current = setInterval(sendLocation, 30_000);
    return () => {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    };
  }, [mapReady, isManager]);

  // ── Manager: poll rep locations + render dots ─────────────────────────────
  useEffect(() => {
    if (!mapReady || !isManager) return;

    function fetchRepLocations() {
      fetch("/api/manager/rep-locations")
        .then((r) => r.json())
        .then((d) => setRepLocations(d.data ?? []))
        .catch(() => {});
    }

    fetchRepLocations();
    locationIntervalRef.current = setInterval(fetchRepLocations, 30_000);
    return () => {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    };
  }, [mapReady, isManager]);

  // ── Render rep location markers on map ────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isManager) return;

    const existing = repMarkersRef.current;

    // Remove stale markers
    existing.forEach((marker, userId) => {
      if (!repLocations.find((r) => r.user_id === userId)) {
        marker.remove();
        existing.delete(userId);
      }
    });

    // Add / update markers
    const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444"];
    repLocations.forEach((rep, i) => {
      const color = COLORS[i % COLORS.length];
      const el = document.createElement("div");
      el.style.cssText = `
        width:32px;height:32px;border-radius:50%;background:${color};
        display:flex;align-items:center;justify-content:center;
        color:white;font-weight:700;font-size:11px;font-family:sans-serif;
        border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25);
        cursor:default;
      `;
      el.title = rep.full_name;
      el.textContent = rep.initials;

      if (existing.has(rep.user_id)) {
        existing.get(rep.user_id)!.setLngLat([rep.lng, rep.lat]);
      } else {
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([rep.lng, rep.lat])
          .addTo(map);
        existing.set(rep.user_id, marker);
      }
    });
  }, [repLocations, isManager]);

  // ── Canvas drag-select ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!drawMode) return;
    const canvas = selectionCanvasRef.current;
    const map = mapRef.current;
    if (!canvas || !map) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function clearCanvas() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function drawRect(s: { x: number; y: number }, e: { x: number; y: number }) {
      if (!ctx || !canvas) return;
      clearCanvas();
      const x = Math.min(s.x, e.x);
      const y = Math.min(s.y, e.y);
      const w = Math.abs(e.x - s.x);
      const h = Math.abs(e.y - s.y);
      ctx.fillStyle = "rgba(59,130,246,0.1)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(59,130,246,0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(x, y, w, h);
    }

    function onMouseDown(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      dragStart.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      dragCurrent.current = { ...dragStart.current };
    }

    function onMouseMove(e: MouseEvent) {
      if (!dragStart.current) return;
      const rect = canvas!.getBoundingClientRect();
      dragCurrent.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      drawRect(dragStart.current, dragCurrent.current);
    }

    function onMouseUp() {
      if (!dragStart.current || !dragCurrent.current || !map) return;
      const s = dragStart.current;
      const e = dragCurrent.current;
      clearCanvas();
      dragStart.current = null;
      dragCurrent.current = null;

      // Skip tiny accidental clicks
      if (Math.abs(e.x - s.x) < 10 || Math.abs(e.y - s.y) < 10) return;

      const rect = canvas!.getBoundingClientRect();
      const sw = map.unproject([Math.min(s.x, e.x) - rect.left + rect.left, Math.max(s.y, e.y)]);
      const ne = map.unproject([Math.max(s.x, e.x), Math.min(s.y, e.y)]);

      const inside = leads.filter((lead) => {
        if (lead.lat == null || lead.lng == null) return false;
        return (
          lead.lat >= sw.lat && lead.lat <= ne.lat &&
          lead.lng >= sw.lng && lead.lng <= ne.lng
        );
      });

      setDrawMode(false);

      if (inside.length > 0) {
        setBulkLeads(inside);
        setBulkTab("lead");
        setBulkAssignOpen(true);
      }
    }

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      clearCanvas();
    };
  }, [drawMode, leads]);

  function toggleDrawMode() {
    setDrawMode((prev) => !prev);
    dragStart.current = null;
    dragCurrent.current = null;
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
    setBulkTab("lead");
    fetchAndSyncLeads().then(syncLeadsToMap);
  }


  // ── Add GeoJSON layers ─────────────────────────────────────────────────────
  function addLeadsLayer(map: mapboxgl.Map) {
    // ── FCC AT&T coverage — GeoJSON hex polygons ─────────────────────────────
    map.addSource("fcc-coverage", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    map.addLayer({
      id: "fcc-coverage-dots",
      type: "circle",
      source: "fcc-coverage",
      paint: {
        "circle-color": "#22c55e",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 4, 14, 7, 17, 10],
        "circle-opacity": 0.8,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#15803d",
      },
    });

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

  // ── FCC coverage fetch ────────────────────────────────────────────────────
  const coverageFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCoverage = useCallback((map: mapboxgl.Map) => {
    // Only fetch at zoom >= 11 — wider viewports hit too many of 6.4M rows
    if (map.getZoom() < 11) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    const params = new URLSearchParams({
      north: String(bounds.getNorth()),
      south: String(bounds.getSouth()),
      east:  String(bounds.getEast()),
      west:  String(bounds.getWest()),
    });
    fetch(`/api/fcc/coverage?${params}`)
      .then(async (r) => {
        const text = await r.text();
        console.log("[FCC] status:", r.status, "body:", text.slice(0, 300));
        let geojson;
        try { geojson = JSON.parse(text); } catch (e) { console.error("[FCC] invalid JSON", e); return; }
        if (geojson.error) { console.error("[FCC] API error:", geojson.error); return; }
        if (!geojson.type || !Array.isArray(geojson.features)) { console.error("[FCC] bad shape:", geojson); return; }
        console.log("[FCC]", geojson.features.length, "hexes");
        const m = mapRef.current;
        if (!m) return;
        const src = m.getSource("fcc-coverage") as mapboxgl.GeoJSONSource | undefined;
        if (!src) { console.error("[FCC] source not found"); return; }
        src.setData(geojson);
      })
      .catch((err) => console.error("[FCC] fetch error:", err));
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!styleLoaded || !map) return;
    // Large pad on first load so coverage is ready before user pans
    fetchCoverage(map);
    const onMoveEnd = () => {
      if (coverageFetchTimer.current) clearTimeout(coverageFetchTimer.current);
      coverageFetchTimer.current = setTimeout(() => fetchCoverage(map), 800);
    };
    map.on("moveend", onMoveEnd);
    return () => { map.off("moveend", onMoveEnd); };
  }, [styleLoaded, fetchCoverage]);

  // ── Fetch leads and sync to map ────────────────────────────────────────────
  const fetchAndSyncLeads = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.carrier) params.set("carrier", filters.carrier);
    if (filters.status) params.set("status", filters.status);
    if (filters.tags?.length) params.set("tags", filters.tags.join(","));
    if (filters.is_do_not_knock !== undefined)
      params.set("is_do_not_knock", String(filters.is_do_not_knock));
    params.set("page_size", "2000");

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

      {/* Drag-select overlay canvas */}
      {drawMode && (
        <canvas
          ref={selectionCanvasRef}
          className="absolute inset-0 z-20 cursor-crosshair"
          width={containerRef.current?.clientWidth ?? 800}
          height={containerRef.current?.clientHeight ?? 600}
        />
      )}

      {/* DNK Warning Toast */}
      {dnkWarning && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl bg-red-600 text-white px-4 py-2.5 shadow-lg text-sm font-medium max-w-xs text-center">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <span>Do Not Knock — {dnkWarning}</span>
          <button onClick={() => setDnkWarning(null)} className="ml-1 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Knock counter badge (reps, field mode hides other UI) */}
      {!isManager && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-gray-900/85 backdrop-blur-sm text-white px-4 py-1.5 shadow-lg text-sm font-semibold">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            {knockCount} knock{knockCount !== 1 ? "s" : ""} today
          </div>
          <button
            onClick={() => setFieldMode((f) => !f)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold shadow-md transition-colors ${
              fieldMode
                ? "bg-blue-600 text-white"
                : "bg-white/90 backdrop-blur-sm text-gray-700 border border-gray-200"
            }`}
          >
            {fieldMode ? "Exit Field Mode" : "Field Mode"}
          </button>
        </div>
      )}

      {/* Rep location legend (managers only, when reps are active) */}
      {isManager && repLocations.length > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full bg-gray-900/80 backdrop-blur-sm text-white px-3 py-1.5 shadow-lg text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          {repLocations.length} rep{repLocations.length !== 1 ? "s" : ""} active
        </div>
      )}

      {/* Map controls overlay — hidden in field mode */}
      <div className={`absolute top-3 left-3 z-10 flex flex-col gap-2 transition-opacity ${fieldMode ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
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

      {/* Bottom hint — hidden in field mode */}
      <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-10 transition-opacity ${fieldMode ? "opacity-0 pointer-events-none" : ""}`}>
        <div className="rounded-full bg-white/80 backdrop-blur-sm border border-gray-200 shadow-sm px-4 py-1.5 text-xs text-gray-500">
          {geocoding
            ? "Looking up address & checking FCC coverage…"
            : drawMode
            ? "Click and drag to select an area — release to see results"
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
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col max-h-[85vh]">
            <div className="px-6 pt-5 pb-3">
              <h3 className="text-base font-semibold text-gray-900">
                {bulkLeads.length} Address{bulkLeads.length !== 1 ? "es" : ""} Selected
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Review then assign to a team lead or team</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-6">
              {([
                { key: "lead", label: "Addresses" },
                { key: "team", label: "Distribute to Team" },
                { key: "rep", label: "Assign to Person" },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setBulkTab(t.key)}
                  className={`py-2.5 px-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    bulkTab === t.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Addresses tab */}
              {bulkTab === "lead" && (
                <div className="flex flex-col gap-1.5">
                  {bulkLeads.map((lead) => (
                    <div key={lead.id} className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{lead.address}</p>
                        {lead.customer_name && (
                          <p className="text-xs text-gray-400">{lead.customer_name}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setBulkTab("team")}
                    className="mt-3 w-full rounded-xl bg-blue-500 text-white text-sm font-medium py-3 hover:bg-blue-600 transition-colors"
                  >
                    Assign These Leads →
                  </button>
                </div>
              )}

              {/* Team distribute tab */}
              {bulkTab === "team" && (
                <div className="flex flex-col gap-2">
                  {teams.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">No teams yet — create one in the Manager panel.</p>
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
                          {team.member_count} rep{team.member_count !== 1 ? "s" : ""} · {bulkLeads.length} leads split evenly
                        </p>
                      </div>
                      <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}

              {/* Individual person tab */}
              {bulkTab === "rep" && (
                <div className="flex flex-col gap-2">
                  {reps
                    .filter((r) => r.role === "team_lead" || r.role === "sales_rep")
                    .sort((a, b) => {
                      // Team leads first
                      if (a.role === "team_lead" && b.role !== "team_lead") return -1;
                      if (b.role === "team_lead" && a.role !== "team_lead") return 1;
                      return a.full_name.localeCompare(b.full_name);
                    })
                    .map((rep) => (
                      <button
                        key={rep.user_id}
                        disabled={bulkAssigning}
                        onClick={() => handleBulkAssign({ assign_to: rep.user_id })}
                        className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 hover:bg-blue-50 hover:border-blue-200 transition-colors text-left disabled:opacity-50"
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-blue-700">{rep.full_name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{rep.full_name}</p>
                          <p className="text-xs text-gray-400 capitalize">{rep.role.replace("_", " ")}</p>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => { setBulkAssignOpen(false); setBulkLeads([]); setBulkTab("lead"); }}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status legend — hidden in field mode */}
      {!fieldMode && (
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
      )}

      {/* Quick-log sheet (Spotio-style) */}
      {quickLogLead && (
        <QuickLogSheet
          lead={quickLogLead}
          onClose={() => setQuickLogLead(null)}
          onStatusLogged={(newStatus) => {
            setQuickLogLead(null);
            setKnockCount((c) => c + 1);
            // Update lead in state + map
            setLeads((prev) =>
              prev.map((l) => l.id === quickLogLead.id ? { ...l, status: newStatus as Lead["status"] } : l)
            );
            fetchAndSyncLeads().then(syncLeadsToMap);
          }}
          onOpenFull={() => {
            onSelectLead(quickLogLead.id);
            setQuickLogLead(null);
          }}
        />
      )}
    </div>
  );
}
