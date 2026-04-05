"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Lead } from "@/lib/types";

// ── Geo helpers ────────────────────────────────────────────────────────────────
function toRad(deg: number) { return (deg * Math.PI) / 180; }
function toDeg(rad: number) { return (rad * 180) / Math.PI; }

/** Bearing in degrees (0=N, 90=E, …) from point A to point B */
function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Haversine distance in metres */
function distance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Constants ─────────────────────────────────────────────────────────────────
const H_FOV = 70;   // horizontal camera FOV (degrees)
const V_FOV = 50;   // vertical camera FOV (degrees)
const MAX_DIST = 150; // only render halos within this many metres
const EYE_HEIGHT = 1.6; // metres above ground

interface Props {
  onClose: () => void;
}

export default function ARView({ onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const headingRef = useRef(0);
  const pitchRef = useRef(90); // device beta: 90 = upright/vertical
  const posRef = useRef<{ lat: number; lng: number } | null>(null);
  const leadsRef = useRef<Lead[]>([]);

  const [permState, setPermState] = useState<"pending" | "granted" | "denied">("pending");
  const [gpsReady, setGpsReady] = useState(false);
  const [leadsLoaded, setLeadsLoaded] = useState(false);
  const [compassHeading, setCompassHeading] = useState(0);

  // ── Camera ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setPermState("granted");
      } catch {
        setPermState("denied");
      }
    }

    startCamera();
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  // ── GPS ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        posRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsReady(true);
      },
      null,
      { enableHighAccuracy: true, maximumAge: 2000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // ── Device orientation (compass) ────────────────────────────────────────────
  useEffect(() => {
    function handleOrientation(e: DeviceOrientationEvent) {
      // iOS provides webkitCompassHeading (true north); Android uses absolute alpha
      const ios = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      headingRef.current = ios != null ? ios : (360 - (e.alpha ?? 0)) % 360;
      pitchRef.current = e.beta ?? 90; // 90 = vertical/upright
      setCompassHeading(Math.round(headingRef.current));
    }

    // iOS 13+ requires explicit permission
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DOE = DeviceOrientationEvent as any;
    if (typeof DOE.requestPermission === "function") {
      DOE.requestPermission()
        .then(() => window.addEventListener("deviceorientationabsolute", handleOrientation, true))
        .catch(() => window.addEventListener("deviceorientationabsolute", handleOrientation, true));
    } else {
      window.addEventListener("deviceorientationabsolute", handleOrientation, true);
      // Fallback for Firefox / older browsers
      window.addEventListener("deviceorientation", handleOrientation, true);
    }

    return () => {
      window.removeEventListener("deviceorientationabsolute", handleOrientation, true);
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, []);

  // ── Fetch nearby leads ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!gpsReady) return;
    fetch("/api/leads?page_size=100")
      .then((r) => r.json())
      .then((d) => {
        leadsRef.current = d.data ?? [];
        setLeadsLoaded(true);
      })
      .catch(() => {});
  }, [gpsReady]);

  // ── Canvas draw loop ────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) { rafRef.current = requestAnimationFrame(draw); return; }

    const W = canvas.parentElement?.clientWidth ?? window.innerWidth;
    const H = canvas.parentElement?.clientHeight ?? window.innerHeight;
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }
    ctx.clearRect(0, 0, W, H);

    const pos = posRef.current;
    const leads = leadsRef.current;
    if (!pos || !leads.length) { rafRef.current = requestAnimationFrame(draw); return; }

    const heading = headingRef.current;
    const beta = pitchRef.current; // device tilt: 0=flat, 90=vertical
    // Camera pitch relative to horizontal: 90=vertical means pointing at horizon
    const cameraPitchFromHoriz = beta - 90; // positive = tilting back (camera pointing up)

    for (const lead of leads) {
      if (!lead.lat || !lead.lng) continue;

      const dist = distance(pos.lat, pos.lng, lead.lat, lead.lng);
      if (dist > MAX_DIST || dist < 1) continue;

      const bear = bearing(pos.lat, pos.lng, lead.lat, lead.lng);
      const relAzimuth = ((bear - heading + 540) % 360) - 180; // -180 to +180

      // Skip if outside horizontal FOV with some margin
      if (Math.abs(relAzimuth) > H_FOV / 2 + 15) continue;

      // Elevation angle to property at ground level (below eye height)
      const elevDeg = -toDeg(Math.atan2(EYE_HEIGHT, dist)); // negative = below horizon

      // Elevation relative to where camera is pointing
      const relElev = elevDeg - cameraPitchFromHoriz;

      // Project to screen coordinates
      const x = W / 2 + (relAzimuth / (H_FOV / 2)) * (W / 2);
      const y = H / 2 - (relElev / (V_FOV / 2)) * (H / 2);

      // Halo radius scales with distance (closer = bigger)
      const radius = Math.max(24, Math.min(90, 5000 / dist));

      const isDNK = lead.is_do_not_knock;
      const isAtt = lead.carrier_availability?.att ?? false;

      const color = isDNK ? "#ef4444" : isAtt ? "#22c55e" : "#f97316";
      const labelColor = isDNK ? "#fca5a5" : isAtt ? "#86efac" : "#fdba74";

      // Outer glow ring
      const glow = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 1.6);
      glow.addColorStop(0, color + "30");
      glow.addColorStop(1, color + "00");
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.6, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Halo ring
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.9;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Inner fill (subtle)
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      const inner = ctx.createRadialGradient(x, y, 0, x, y, radius);
      inner.addColorStop(0, color + "22");
      inner.addColorStop(1, color + "00");
      ctx.fillStyle = inner;
      ctx.fill();

      // Distance badge
      const distLabel = dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`;
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Badge background
      const badgeW = ctx.measureText(distLabel).width + 16;
      const badgeH = 20;
      const badgeY = y + radius + 14;
      ctx.beginPath();
      ctx.roundRect(x - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 8);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fill();
      ctx.fillStyle = labelColor;
      ctx.fillText(distLabel, x, badgeY);

      // Address label (only close leads)
      if (dist < 60 && lead.address) {
        const addr = lead.address.length > 28 ? lead.address.slice(0, 25) + "…" : lead.address;
        ctx.font = "12px system-ui, sans-serif";
        const addrW = ctx.measureText(addr).width + 16;
        const addrY = y - radius - 14;
        ctx.beginPath();
        ctx.roundRect(x - addrW / 2, addrY - 10, addrW, 20, 6);
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillText(addr, x, addrY);
      }

      // DNK label
      if (isDNK) {
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.fillStyle = "#ef4444";
        ctx.fillText("DO NOT KNOCK", x, y);
      }
    }

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (permState === "denied") {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center text-white gap-4 px-8 text-center">
        <p className="text-lg font-semibold">Camera access denied</p>
        <p className="text-sm text-gray-400">Allow camera access in your browser settings to use AR view.</p>
        <button onClick={onClose} className="mt-4 rounded-full bg-white/10 px-6 py-2 text-sm">Close</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden">
      {/* Camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* AR canvas overlay */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-4 pt-safe-top pt-4">
        {/* Compass */}
        <div className="flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-sm px-3 py-1.5 text-white text-sm">
          <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 2L8.5 9.5H2l5.5 4.5-2 7L12 17l6.5 4-2-7L22 9.5h-6.5L12 2z" />
          </svg>
          {compassHeading}°
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-2">
          {!gpsReady && (
            <span className="rounded-full bg-yellow-500/80 px-2.5 py-1 text-xs font-medium text-white">
              Locating…
            </span>
          )}
          {gpsReady && !leadsLoaded && (
            <span className="rounded-full bg-blue-500/80 px-2.5 py-1 text-xs font-medium text-white">
              Loading leads…
            </span>
          )}
          {gpsReady && leadsLoaded && (
            <span className="rounded-full bg-green-500/80 px-2.5 py-1 text-xs font-medium text-white">
              {leadsRef.current.length} leads
            </span>
          )}
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-colors"
          aria-label="Close AR view"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-8 left-4 z-10 rounded-xl bg-black/50 backdrop-blur-sm px-3 py-2 text-xs text-white space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full border-2 border-green-400 bg-transparent" />
          AT&T available
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full border-2 border-orange-400 bg-transparent" />
          Not available
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full border-2 border-red-400 bg-transparent" />
          Do Not Knock
        </div>
      </div>

      {/* Hint */}
      <div className="absolute bottom-8 inset-x-0 flex justify-center z-10 pointer-events-none">
        <div className="rounded-full bg-black/40 backdrop-blur-sm px-4 py-1.5 text-xs text-gray-300">
          Point camera at homes within {MAX_DIST}m
        </div>
      </div>
    </div>
  );
}
