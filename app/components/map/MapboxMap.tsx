"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import mapboxgl from "mapbox-gl";
import { Lead, LeadFilters } from "@/lib/types";
import CaptureLeadModal from "./CaptureLeadModal";
import DrawAreaLeadModal from "./DrawAreaLeadModal";
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
  // Always-current leads ref so canvas closures never see stale data
  const leadsRef = useRef<Lead[]>([]);

  const { profile } = useProfile();
  const isManager = profile?.role === "admin" || profile?.role === "sales_manager" || profile?.role === "team_lead";
  // Select Area visible to all elevated roles; hidden from sales_rep only
  const canBulkAssign = isManager;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [styleLoaded, setStyleLoaded] = useState(false);
  const [captureInfo, setCaptureInfo] = useState<MapClickInfo | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [mapStyle, setMapStyle] = useState<"streets" | "satellite">("streets");
  const [drawMode, setDrawMode] = useState(false);
  const [showAttDots, setShowAttDots] = useState(false);
  const [showFiberHeat, setShowFiberHeat] = useState(false);
  const [drawAreaOpen, setDrawAreaOpen] = useState(false);
  const [drawAreaBbox, setDrawAreaBbox] = useState<{ south: number; north: number; west: number; east: number } | null>(null);
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

  // UI auto-fade: controls dim after 4 s of inactivity so the map is visible
  const [uiOpaque, setUiOpaque]     = useState(false);
  const uiIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function wakeUi() {
    setUiOpaque(true);
    if (uiIdleTimer.current) clearTimeout(uiIdleTimer.current);
    uiIdleTimer.current = setTimeout(() => setUiOpaque(false), 4000);
  }

  // Knock counter — persisted in localStorage per calendar day
  // Key is stable (no user-id dependency) so the initial read is always correct.
  const knockKey = `knock_${new Date().toDateString()}`;
  const [knockCount, setKnockCount] = useState<number>(() => {
    try { return parseInt(localStorage.getItem(`knock_${new Date().toDateString()}`) ?? "0", 10) || 0; } catch { return 0; }
  });

  // Field mode (Badger)
  const [fieldMode, setFieldMode] = useState(false);
  const [zipInput, setZipInput]   = useState("");
  const [zipError, setZipError]   = useState(false);

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

    // Restore last position, otherwise geolocate, otherwise fall back to center-US
    const saved = (() => {
      try {
        const raw = localStorage.getItem("map_position");
        if (raw) return JSON.parse(raw) as { lng: number; lat: number; zoom: number };
      } catch { /* ignore */ }
      return null;
    })();

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: saved ? [saved.lng, saved.lat] : [-97.0, 38.5],
      zoom: saved ? saved.zoom : 4,
      attributionControl: false,
    });

    // If no saved position, geolocate on first load
    if (!saved) {
      map.once("load", () => {
        navigator.geolocation?.getCurrentPosition(
          ({ coords }) => {
            map.flyTo({ center: [coords.longitude, coords.latitude], zoom: 13, duration: 1200 });
          },
          () => { /* permission denied — stay at default */ }
        );
      });
    }

    // Save position on every move (geolocation, user pan/zoom, ZIP jump — all count).
    map.on("moveend", () => {
      const { lng, lat } = map.getCenter();
      try {
        localStorage.setItem("map_position", JSON.stringify({ lng, lat, zoom: map.getZoom() }));
      } catch { /* ignore quota errors */ }
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

    function drawRect(s: { x: number; y: number }, cur: { x: number; y: number }) {
      if (!ctx || !canvas) return;
      clearCanvas();
      const x = Math.min(s.x, cur.x);
      const y = Math.min(s.y, cur.y);
      const w = Math.abs(cur.x - s.x);
      const h = Math.abs(cur.y - s.y);
      ctx.fillStyle = "rgba(59,130,246,0.12)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(59,130,246,0.9)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(x, y, w, h);
    }

    function clientToCanvas(clientX: number, clientY: number) {
      // Use the map container's bounding rect (not the canvas) so that pixel
      // coordinates are always in the same space that map.unproject() expects.
      const rect = map!.getContainer().getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function finishSelection(s: { x: number; y: number }, end: { x: number; y: number }) {
      clearCanvas();
      dragStart.current = null;
      dragCurrent.current = null;
      if (Math.abs(end.x - s.x) < 10 || Math.abs(end.y - s.y) < 10) return;

      // Convert the drawn pixel rectangle to a geographic bounding box,
      // then open DrawAreaLeadModal which fetches OSM addresses within it.
      const swLngLat = map!.unproject([Math.min(s.x, end.x), Math.max(s.y, end.y)]);
      const neLngLat = map!.unproject([Math.max(s.x, end.x), Math.min(s.y, end.y)]);

      setDrawMode(false);
      setDrawAreaBbox({
        south: swLngLat.lat,
        north: neLngLat.lat,
        west:  swLngLat.lng,
        east:  neLngLat.lng,
      });
      setDrawAreaOpen(true);
    }

    // Mouse
    function onMouseDown(e: MouseEvent) {
      const pt = clientToCanvas(e.clientX, e.clientY);
      dragStart.current = pt;
      dragCurrent.current = { ...pt };
    }
    function onMouseMove(e: MouseEvent) {
      if (!dragStart.current) return;
      dragCurrent.current = clientToCanvas(e.clientX, e.clientY);
      drawRect(dragStart.current, dragCurrent.current);
    }
    function onMouseUp() {
      if (!dragStart.current || !dragCurrent.current) return;
      finishSelection(dragStart.current, dragCurrent.current);
    }

    // Touch
    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      const t = e.touches[0];
      const pt = clientToCanvas(t.clientX, t.clientY);
      dragStart.current = pt;
      dragCurrent.current = { ...pt };
    }
    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      if (!dragStart.current) return;
      const t = e.touches[0];
      dragCurrent.current = clientToCanvas(t.clientX, t.clientY);
      drawRect(dragStart.current, dragCurrent.current);
    }
    function onTouchEnd(e: TouchEvent) {
      e.preventDefault();
      if (!dragStart.current || !dragCurrent.current) return;
      finishSelection(dragStart.current, dragCurrent.current);
    }

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      clearCanvas();
    };
  }, [drawMode]);

  function toggleDrawMode() {
    setDrawMode((prev) => !prev);
    dragStart.current = null;
    dragCurrent.current = null;
  }

  async function handleBulkAssign(opts: { assign_to?: string | null; team_id?: string; lead_ids?: string[] }) {
    const ids = opts.lead_ids ?? bulkLeads.map((l) => l.id);
    if (!ids.length) return;
    setBulkAssigning(true);
    const { lead_ids: _, ...rest } = opts;
    await fetch("/api/leads/bulk-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_ids: ids, ...rest }),
    });
    setBulkAssigning(false);
    setBulkAssignOpen(false);
    setBulkLeads([]);
    setBulkTab("lead");
    fetchAndSyncLeads().then(syncLeadsToMap);
  }


  // ── Add GeoJSON layers ─────────────────────────────────────────────────────
  function addLeadsLayer(map: mapboxgl.Map) {
    // Find the first symbol layer in the base style so coverage fill/dots
    // are inserted below road labels — keeps streets always readable.
    const firstSymbolId = map.getStyle()?.layers?.find((l) => l.type === "symbol")?.id;

    // ── FCC AT&T coverage — census block polygons ─────────────────────────────
    map.addSource("fcc-coverage", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    map.addLayer({
      id: "fcc-coverage-fill",
      type: "fill",
      source: "fcc-coverage",
      paint: {
        "fill-color": "#22c55e",
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.25, 13, 0.15, 16, 0.08],
      },
    }, firstSymbolId);

    map.addLayer({
      id: "fcc-coverage-outline",
      type: "line",
      source: "fcc-coverage",
      paint: {
        "line-color": "#16a34a",
        "line-width": 1,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0, 11, 0.6, 15, 0.3],
      },
    }, firstSymbolId);

    // ── BDC fiber heat map ────────────────────────────────────────────────────
    map.addSource("fiber-heat", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "fiber-heat-layer",
      type: "heatmap",
      source: "fiber-heat",
      paint: {
        "heatmap-weight": 1,
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 7, 0.8, 13, 1.8],
        "heatmap-radius":   ["interpolate", ["linear"], ["zoom"], 7, 14, 10, 22, 13, 35],
        "heatmap-opacity":  ["interpolate", ["linear"], ["zoom"], 7, 0.80, 14, 0.60],
        "heatmap-color": [
          "interpolate", ["linear"], ["heatmap-density"],
          0,   "rgba(0,0,0,0)",
          0.15,"rgba(103,169,207,0.6)",
          0.35,"rgba(65,182,196,0.8)",
          0.55,"rgba(35,139,69,0.9)",
          0.75,"rgba(161,217,155,0.95)",
          1,   "rgba(255,255,178,1)",
        ],
      },
    }, firstSymbolId);

    // ── AT&T fiber address dots ───────────────────────────────────────────────
    // Individual address-level points from FCC BDC data — shown as blue dots.
    // Inserted below symbol layers so road labels remain visible.
    map.addSource("att-dots", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    map.addLayer({
      id: "att-dots-layer",
      type: "circle",
      source: "att-dots",
      paint: {
        "circle-color": "#3b82f6",
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          13, 3,
          16, 5,
          18, 7,
        ],
        "circle-opacity": 0.75,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#1d4ed8",
        "circle-stroke-opacity": 0.6,
      },
    }, firstSymbolId);

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
    // Census block polygons are large — only fetch at zoom >= 10
    if (map.getZoom() < 10) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    const params = new URLSearchParams({
      north: String(bounds.getNorth()),
      south: String(bounds.getSouth()),
      east:  String(bounds.getEast()),
      west:  String(bounds.getWest()),
    });
    fetch(`/api/fcc/blocks?${params}`)
      .then(async (r) => {
        let geojson;
        try { geojson = await r.json(); } catch (e) { console.error("[FCC blocks] invalid JSON", e); return; }
        if (geojson.error) { console.error("[FCC blocks] API error:", geojson.error); return; }
        if (!geojson.type || !Array.isArray(geojson.features)) { console.error("[FCC blocks] bad shape:", geojson); return; }
        const m = mapRef.current;
        if (!m) return;
        const src = m.getSource("fcc-coverage") as mapboxgl.GeoJSONSource | undefined;
        if (!src) { console.error("[FCC blocks] source not found"); return; }
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

  // ── AT&T fiber address dots fetch ─────────────────────────────────────────
  const attDotsFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAttDots = useCallback((map: mapboxgl.Map) => {
    const src = map.getSource("att-dots") as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    // Only show address-level dots when zoomed in enough to be useful
    if (map.getZoom() < 13) {
      src.setData({ type: "FeatureCollection", features: [] });
      return;
    }
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
        const geojson = await r.json();
        if (!geojson.type) return;
        const m = mapRef.current;
        if (!m) return;
        const s = m.getSource("att-dots") as mapboxgl.GeoJSONSource | undefined;
        if (s) s.setData(geojson);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!styleLoaded || !map) return;
    const src = map.getSource("att-dots") as mapboxgl.GeoJSONSource | undefined;
    if (!showAttDots) {
      if (src) src.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    fetchAttDots(map);
    const onMoveEnd = () => {
      if (attDotsFetchTimer.current) clearTimeout(attDotsFetchTimer.current);
      attDotsFetchTimer.current = setTimeout(() => fetchAttDots(map), 600);
    };
    map.on("moveend", onMoveEnd);
    return () => {
      map.off("moveend", onMoveEnd);
      if (attDotsFetchTimer.current) clearTimeout(attDotsFetchTimer.current);
    };
  }, [styleLoaded, showAttDots, fetchAttDots]);

  // ── Fiber heat map fetch ───────────────────────────────────────────────────
  const heatFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchFiberHeat = useCallback((map: mapboxgl.Map) => {
    const src = map.getSource("fiber-heat") as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    if (map.getZoom() < 7) {
      src.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    const bounds = map.getBounds();
    if (!bounds) return;
    const params = new URLSearchParams({
      north: String(bounds.getNorth()),
      south: String(bounds.getSouth()),
      east:  String(bounds.getEast()),
      west:  String(bounds.getWest()),
    });
    fetch(`/api/leads/fiber-heatmap?${params}`)
      .then(async (r) => {
        const geojson = await r.json();
        if (!geojson.type) return;
        const m = mapRef.current;
        if (!m) return;
        const s = m.getSource("fiber-heat") as mapboxgl.GeoJSONSource | undefined;
        if (s) s.setData(geojson);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!styleLoaded || !map) return;
    const src = map.getSource("fiber-heat") as mapboxgl.GeoJSONSource | undefined;
    if (!showFiberHeat) {
      if (src) src.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    fetchFiberHeat(map);
    const onMoveEnd = () => {
      if (heatFetchTimer.current) clearTimeout(heatFetchTimer.current);
      heatFetchTimer.current = setTimeout(() => fetchFiberHeat(map), 400);
    };
    map.on("moveend", onMoveEnd);
    return () => {
      map.off("moveend", onMoveEnd);
      if (heatFetchTimer.current) clearTimeout(heatFetchTimer.current);
    };
  }, [styleLoaded, showFiberHeat, fetchFiberHeat]);

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
      leadsRef.current = fetched;
      return fetched;
    } catch {
      return [];
    }
  }, [filters]);

  // Sync fetched leads → Mapbox GeoJSON source
  const hasFitToLeads = useRef(false);

  const syncLeadsToMap = useCallback((fetched: Lead[]) => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("leads") as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    const withCoords = fetched.filter((lead) => lead.lat != null && lead.lng != null);

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: withCoords.map((lead) => ({
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

    // On first load, if none of the leads are in the current viewport, fly to fit them all.
    if (!hasFitToLeads.current && withCoords.length > 0) {
      hasFitToLeads.current = true;
      const bounds = map.getBounds();
      if (bounds) {
        const anyVisible = withCoords.some(
          (l) =>
            (l.lng as number) >= bounds.getWest() &&
            (l.lng as number) <= bounds.getEast() &&
            (l.lat as number) >= bounds.getSouth() &&
            (l.lat as number) <= bounds.getNorth(),
        );
        if (!anyVisible) {
          const lngs = withCoords.map((l) => l.lng as number);
          const lats = withCoords.map((l) => l.lat as number);
          map.fitBounds(
            [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
            { padding: 60, maxZoom: 14, duration: 1200 },
          );
        }
      }
    }
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
  async function goToZip(e: React.FormEvent) {
    e.preventDefault();
    const zip = zipInput.trim();
    if (!zip || !mapRef.current) return;
    setZipError(false);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(zip)}.json` +
        `?types=postcode&country=us&limit=1&access_token=${token}`
      );
      const data = await res.json();
      const [lng, lat] = data.features?.[0]?.center ?? [];
      if (lng == null || lat == null) { setZipError(true); return; }
      mapRef.current.flyTo({ center: [lng, lat], zoom: 13, duration: 1000 });
      setZipInput("");
    } catch {
      setZipError(true);
    }
  }

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
        <>
          <canvas
            ref={selectionCanvasRef}
            className="absolute inset-0 z-20 cursor-crosshair touch-none"
            width={containerRef.current?.clientWidth ?? 800}
            height={containerRef.current?.clientHeight ?? 600}
          />
          {/* Cancel button rendered above the canvas so it's always tappable */}
          <div className="absolute top-3 left-3 z-30 flex flex-col gap-2">
            <button
              onClick={() => { setDrawMode(false); dragStart.current = null; dragCurrent.current = null; }}
              className="flex items-center gap-1.5 rounded-xl bg-white border border-gray-300 shadow-md px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
            <div className="rounded-xl bg-blue-600/90 backdrop-blur-sm text-white px-3 py-2 text-xs font-medium shadow-md max-w-[160px]">
              Drag to select leads on the map
            </div>
          </div>
        </>
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

      {/* Knock counter — bottom-left, subtle pill. Hidden only for pure managers (sales_manager). */}
      {profile?.role !== "sales_manager" && (
        <div className="absolute bottom-4 left-3 z-20 flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white/90 px-3 py-1 text-xs font-medium shadow pointer-events-none select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
          {knockCount} knock{knockCount !== 1 ? "s" : ""}
        </div>
      )}

      {/* Rep location legend (managers only, when reps are active) */}
      {isManager && repLocations.length > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full bg-gray-900/80 backdrop-blur-sm text-white px-3 py-1.5 shadow-lg text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          {repLocations.length} rep{repLocations.length !== 1 ? "s" : ""} active
        </div>
      )}

      {/* Field mode exit button — always visible when field mode is on */}
      {fieldMode && (
        <button
          onClick={() => setFieldMode(false)}
          className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-xl bg-blue-600 border border-blue-700 text-white shadow-sm px-3 py-1.5 text-xs font-medium"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Exit Field Mode
        </button>
      )}

      {/* Map controls overlay — hidden in field mode, auto-fades when idle */}
      <div
        onPointerDown={wakeUi}
        onPointerEnter={wakeUi}
        className={`absolute top-3 left-3 z-10 flex flex-col gap-2 transition-opacity duration-500 ${
          fieldMode ? "opacity-0 pointer-events-none"
          : (uiOpaque || drawMode || showFiberHeat) ? "opacity-100"
          : "opacity-30"
        }`}
      >
        {/* Zip code jump */}
        <form onSubmit={goToZip} className="flex items-center gap-1">
          <input
            type="text"
            value={zipInput}
            onChange={(e) => { setZipInput(e.target.value); setZipError(false); }}
            placeholder="ZIP code"
            maxLength={10}
            className={`w-24 rounded-xl bg-white/90 backdrop-blur-sm border shadow-sm px-2.5 py-1.5 text-xs font-medium text-gray-800 placeholder-gray-400 outline-none focus:ring-2 transition-colors ${
              zipError ? "border-red-400 focus:ring-red-100" : "border-gray-200 focus:ring-blue-100"
            }`}
          />
          <button
            type="submit"
            className="rounded-xl bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm p-1.5 text-gray-600 hover:bg-white transition-colors"
            aria-label="Go to ZIP"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </form>

        {/* Field mode toggle — shown when NOT in field mode */}
        {profile?.role !== "sales_manager" && (
          <button
            onClick={() => setFieldMode(true)}
            className="flex items-center gap-1.5 rounded-xl bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Field Mode
          </button>
        )}

        {/* Draw / Select Area — admin and sales_manager only */}
        {canBulkAssign && (
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

        {/* Fiber heat map toggle */}
        <button
          onClick={() => setShowFiberHeat((v) => !v)}
          className={`flex items-center gap-1.5 rounded-xl backdrop-blur-sm border shadow-sm px-3 py-1.5 text-xs font-medium transition-colors ${
            showFiberHeat
              ? "bg-green-600 border-green-700 text-white hover:bg-green-700"
              : "bg-white/90 border-gray-200 text-gray-700 hover:bg-white"
          }`}
        >
          <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${showFiberHeat ? "bg-yellow-300" : "bg-gradient-to-r from-blue-400 to-green-400"}`} />
          Fiber Heat Map
        </button>

        {/* Map legend */}
        <div className="rounded-xl bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm px-3 py-2 text-xs text-gray-700">
          <p className="font-semibold mb-1.5 text-gray-900">Legend</p>
          {showFiberHeat && (
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-10 h-2.5 rounded inline-block bg-gradient-to-r from-blue-400 via-green-400 to-yellow-200" />
              Fiber coverage density
            </div>
          )}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-3 h-3 rounded-full border-2 border-green-500 bg-transparent inline-block" />
            Lead — AT&T available
          </div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-3 h-3 rounded-full bg-gray-400 inline-block" />
            Lead — No AT&T
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

      {/* Draw area → create leads modal */}
      {drawAreaOpen && drawAreaBbox && (
        <DrawAreaLeadModal
          bbox={drawAreaBbox}
          reps={reps}
          teams={teams}
          onClose={() => { setDrawAreaOpen(false); setDrawAreaBbox(null); }}
          onDone={(count) => {
            setDrawAreaOpen(false);
            setDrawAreaBbox(null);
            if (count > 0) fetchAndSyncLeads().then(syncLeadsToMap);
          }}
        />
      )}

      {/* Bulk assign modal */}
      {bulkAssignOpen && (
        <BulkAssignModal
          leads={bulkLeads}
          reps={reps}
          teams={teams}
          assigning={bulkAssigning}
          onAssign={handleBulkAssign}
          onClose={() => { setBulkAssignOpen(false); setBulkLeads([]); setBulkTab("lead"); }}
        />
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
            setKnockCount((c) => {
              const next = c + 1;
              try { localStorage.setItem(knockKey, String(next)); } catch { /* ignore */ }
              return next;
            });
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

// ─── Bulk Assign Modal ────────────────────────────────────────────────────────

interface BulkAssignModalProps {
  leads: Lead[];
  reps: { user_id: string; full_name: string; role: string }[];
  teams: { id: string; name: string; member_count: number }[];
  assigning: boolean;
  onAssign: (opts: { assign_to?: string | null; team_id?: string; lead_ids?: string[] }) => void;
  onClose: () => void;
}

function BulkAssignModal({ leads, reps, teams, assigning, onAssign, onClose }: BulkAssignModalProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(leads.map((l) => l.id)));
  const [tab, setTab] = useState<"list" | "pool" | "team" | "rep">("list");

  const selectedLeads = leads.filter((l) => selected.has(l.id));
  const allChecked = selected.size === leads.length;

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(leads.map((l) => l.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              {leads.length === 0
                ? "No leads in selection"
                : `${leads.length} lead${leads.length !== 1 ? "s" : ""} in area`}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {leads.length === 0
                ? "Draw a larger box, or zoom in to see individual leads"
                : `${selected.size} selected · tap to deselect before assigning`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {leads.length === 0 ? (
          <div className="px-5 pb-6 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">No lead pins were found inside the box.</p>
            <button onClick={onClose} className="mt-4 w-full rounded-xl bg-gray-100 text-gray-700 text-sm font-medium py-2.5 hover:bg-gray-200 transition-colors">
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-5 shrink-0">
              {([
                { key: "list", label: "Leads" },
                { key: "pool", label: "Save to Pool" },
                { key: "team", label: "By Team" },
                { key: "rep",  label: "By Person" },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`py-2.5 px-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    tab === t.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">

              {/* Lead list with checkboxes */}
              {tab === "list" && (
                <div className="flex flex-col gap-1">
                  {/* Select all */}
                  <button
                    onClick={toggleAll}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${allChecked ? "bg-blue-500 border-blue-500" : "border-gray-300"}`}>
                      {allChecked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    {allChecked ? "Deselect all" : "Select all"}
                  </button>
                  {leads.map((lead) => {
                    const checked = selected.has(lead.id);
                    return (
                      <button
                        key={lead.id}
                        onClick={() => toggleOne(lead.id)}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${checked ? "bg-blue-50" : "bg-gray-50 opacity-60"}`}
                      >
                        <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${checked ? "bg-blue-500 border-blue-500" : "border-gray-300"}`}>
                          {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{lead.address}</p>
                          {lead.customer_name && <p className="text-xs text-gray-400">{lead.customer_name}</p>}
                        </div>
                        <span className={`ml-auto shrink-0 text-xs rounded-full px-2 py-0.5 capitalize font-medium ${
                          lead.status === "sold" ? "bg-green-100 text-green-700" :
                          lead.status === "new" ? "bg-gray-100 text-gray-500" :
                          "bg-blue-100 text-blue-600"
                        }`}>
                          {lead.status.replace("_", " ")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Save to pool — removes assignment, puts leads in unassigned queue */}
              {tab === "pool" && (
                <div className="flex flex-col gap-4 py-2">
                  <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">
                    <p className="font-semibold mb-1">Save {selected.size} lead{selected.size !== 1 ? "s" : ""} to Unassigned Pool</p>
                    <p className="text-xs text-blue-600 leading-relaxed">
                      These leads will appear in your leads list with no rep assigned.
                      You can then go to <strong>Leads</strong> and distribute them to reps at any time.
                    </p>
                  </div>
                  <button
                    disabled={assigning || selected.size === 0}
                    onClick={() => onAssign({ assign_to: null, lead_ids: [...selected] })}
                    className="w-full rounded-xl bg-blue-600 text-white text-sm font-semibold py-3.5 hover:bg-blue-700 transition-colors disabled:opacity-40"
                  >
                    {assigning ? "Saving…" : `Save ${selected.size} Lead${selected.size !== 1 ? "s" : ""} to Pool`}
                  </button>
                  <p className="text-xs text-gray-400 text-center">
                    After saving, go to Leads → filter by Unassigned to distribute to reps
                  </p>
                </div>
              )}

              {/* Team distribute */}
              {tab === "team" && (
                <div className="flex flex-col gap-2">
                  {teams.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">No teams yet — create one in the Manager panel.</p>
                  )}
                  {teams.map((team) => (
                    <button
                      key={team.id}
                      disabled={assigning || team.member_count === 0 || selected.size === 0}
                      onClick={() => onAssign({ team_id: team.id, lead_ids: [...selected] })}
                      className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3.5 hover:bg-blue-50 hover:border-blue-200 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{team.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {team.member_count} rep{team.member_count !== 1 ? "s" : ""} · {selected.size} lead{selected.size !== 1 ? "s" : ""} split evenly
                        </p>
                      </div>
                      <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}

              {/* Individual rep */}
              {tab === "rep" && (
                <div className="flex flex-col gap-2">
                  {reps
                    .filter((r) => r.role === "team_lead" || r.role === "sales_rep")
                    .sort((a, b) => {
                      if (a.role === "team_lead" && b.role !== "team_lead") return -1;
                      if (b.role === "team_lead" && a.role !== "team_lead") return 1;
                      return a.full_name.localeCompare(b.full_name);
                    })
                    .map((rep) => (
                      <button
                        key={rep.user_id}
                        disabled={assigning || selected.size === 0}
                        onClick={() => onAssign({ assign_to: rep.user_id, lead_ids: [...selected] })}
                        className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3.5 hover:bg-blue-50 hover:border-blue-200 transition-colors text-left disabled:opacity-50"
                      >
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <span className="text-sm font-semibold text-blue-700">{rep.full_name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{rep.full_name}</p>
                          <p className="text-xs text-gray-400 capitalize">{rep.role.replace("_", " ")}</p>
                        </div>
                        <span className="ml-auto text-xs text-blue-500 font-medium">
                          Assign {selected.size}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 shrink-0">
              {selected.size === 0 ? (
                <p className="text-xs text-center text-gray-400">Select at least one lead above</p>
              ) : tab === "list" ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setTab("pool")}
                    className="flex-1 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold py-3 hover:bg-gray-50 transition-colors"
                  >
                    Save to Pool
                  </button>
                  <button
                    onClick={() => setTab("rep")}
                    className="flex-1 rounded-xl bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 transition-colors"
                  >
                    Assign Now →
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setTab("list")}
                  className="w-full text-sm text-gray-400 hover:text-gray-600 py-1"
                >
                  ← Back to lead list
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
