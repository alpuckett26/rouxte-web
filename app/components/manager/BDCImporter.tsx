"use client";

import { useRef, useState } from "react";
import { cellToLatLng } from "h3-js";

// ── Normalizer — strips BOM + punctuation/whitespace ──────────────────────
function norm(s: string) {
  return s.replace(/^\uFEFF/, "").toLowerCase().replace(/[\s_\-\.]/g, "");
}
function get(row: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    for (const [k, v] of Object.entries(row)) {
      if (norm(k) === norm(name)) return v?.trim() ?? "";
    }
  }
  return "";
}

interface ParsedRow {
  address: string;
  lat: number;
  lng: number;
  brand_name: string;
  technology: string;
  max_down: number | null;
  max_up: number | null;
}

// Auto-detect TSV vs CSV
function detectDelim(line: string) {
  return (line.match(/\t/g) ?? []).length > (line.match(/,/g) ?? []).length ? "\t" : ",";
}
function parseLine(line: string, delim: string): string[] {
  if (delim === "\t") return line.split("\t");
  const result: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === "," && !inQ) { result.push(cur); cur = ""; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}

function h3ToLatLng(id: string): [number, number] | null {
  try { const [lat, lng] = cellToLatLng(id); return isNaN(lat) ? null : [lat, lng]; }
  catch { return null; }
}

const BATCH      = 2000;
const CHUNK_SIZE = 8 * 1024 * 1024;
type Stage = "idle" | "phase1" | "phase2" | "done" | "error";

function fmtMB(b: number) { return (b / 1_048_576).toFixed(0) + " MB"; }
function pct(n: number, t: number) { return t > 0 ? Math.min(99, Math.round(n / t * 100)) : 0; }

// Generic file streamer — calls onLine(row, bytesRead) for each data row
async function streamCSV(
  file: File,
  onHeaders: (h: string[]) => void,
  onLine: (row: Record<string, string>, bytes: number) => void | Promise<void>,
) {
  const dec = new TextDecoder("utf-8");
  let buf = "", headers: string[] | null = null, delim = ",", bytesRead = 0, first = true;
  for (let off = 0; off < file.size; off += CHUNK_SIZE) {
    const slice = file.slice(off, Math.min(off + CHUNK_SIZE, file.size));
    const ab = await new Promise<ArrayBuffer>((res, rej) => {
      const fr = new FileReader();
      fr.onload = (e) => res(e.target!.result as ArrayBuffer);
      fr.onerror = () => rej(new Error("Read error"));
      fr.readAsArrayBuffer(slice);
    });
    let text = dec.decode(new Uint8Array(ab), { stream: true });
    bytesRead += ab.byteLength;
    if (first) { if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); first = false; }
    buf += text;
    const nl = buf.lastIndexOf("\n"); if (nl === -1) continue;
    const done = buf.slice(0, nl + 1); buf = buf.slice(nl + 1);
    for (const raw of done.split("\n")) {
      const line = raw.replace(/\r$/, "").trim(); if (!line) continue;
      if (headers === null) {
        delim = detectDelim(line);
        headers = parseLine(line, delim).map(h => h.trim());
        onHeaders(headers); continue;
      }
      const row: Record<string, string> = {};
      parseLine(line, delim).forEach((v, i) => { row[headers![i]] = v.trim(); });
      await onLine(row, bytesRead);
    }
    await new Promise(r => setTimeout(r, 0));
  }
  if (buf.trim() && headers) {
    const row: Record<string, string> = {};
    parseLine(buf.replace(/\r$/, ""), delim).forEach((v, i) => { row[headers![i]] = v.trim(); });
    await onLine(row, file.size);
  }
}

export default function BDCImporter() {
  const availRef  = useRef<HTMLInputElement>(null);
  const fabricRef = useRef<HTMLInputElement>(null);

  const [availFile,  setAvailFile]  = useState<File | null>(null);
  const [fabricFile, setFabricFile] = useState<File | null>(null);
  const [techFilter, setTechFilter] = useState<"50" | "all">("50");

  const [stage,        setStage]       = useState<Stage>("idle");
  const [phase1Pct,    setPhase1Pct]   = useState(0);
  const [fiberIdCount, setFiberIdCount]= useState(0);
  const [phase2Pct,    setPhase2Pct]   = useState(0);
  const [imported,     setImported]    = useState(0);
  const [dupSkip,      setDupSkip]     = useState(0);
  const [coordMode,    setCoordMode]   = useState<"exact" | "h3">("h3");
  const [errorMsg,     setErrorMsg]    = useState<string | null>(null);
  const [errorDetail,  setErrorDetail] = useState<string | null>(null);

  async function startImport() {
    if (!availFile) return;

    setStage("phase1");
    setPhase1Pct(0); setFiberIdCount(0);
    setPhase2Pct(0); setImported(0); setDupSkip(0);
    setErrorMsg(null); setErrorDetail(null);

    const currentFilter = techFilter;
    const fiberIds      = new Set<string>();   // location_id → for Fabric join
    const h3Coords      = new Map<string, [number, number]>(); // location_id → [lat,lng] from H3
    let   totalImported = 0;
    let   totalSkipped  = 0;

    try {
      // ── Phase 1: stream Availability file ─────────────────────────────
      let lastP1 = 0;
      await streamCSV(
        availFile,
        (headers) => {
          const hn = headers.map(norm);
          if (!hn.some(h => h === "locationid")) throw new Error(
            `Missing "location_id" column.\n\nColumns: ${headers.slice(0, 12).join(", ")}\n\n` +
            "Upload the Fixed Broadband Availability file (columns: frn, provider_id, brand_name, location_id, technology, …)"
          );
        },
        (row, bytes) => {
          const tech = get(row, "technology");
          if (currentFilter === "50" && tech !== "50") return;
          const lid = get(row, "location_id", "locationid");
          if (!lid) return;
          fiberIds.add(lid);
          // Stash H3 coords now so we don't re-read the Availability file in phase 2
          if (!h3Coords.has(lid)) {
            const h3id = get(row, "h3_res8_id", "h3res8id");
            if (h3id) { const c = h3ToLatLng(h3id); if (c) h3Coords.set(lid, c); }
          }
          const p = pct(bytes, availFile.size);
          if (p !== lastP1) { lastP1 = p; setPhase1Pct(p); setFiberIdCount(fiberIds.size); }
        },
      );
      setPhase1Pct(100); setFiberIdCount(fiberIds.size);
      if (fiberIds.size === 0) throw new Error(
        `No ${currentFilter === "50" ? "fiber (tech 50) " : ""}locations found.\n\n` +
        "Check that this is the Fixed Broadband Availability CSV."
      );

      // ── Phase 2a: Fabric file → exact lat/lng per location_id ─────────
      if (fabricFile) {
        setCoordMode("exact"); setStage("phase2");
        const exactCoords = new Map<string, { lat: number; lng: number; addr: string }>();
        let lastP2 = 0;
        await streamCSV(
          fabricFile,
          (headers) => {
            const hn = headers.map(norm);
            if (!hn.some(h => h === "latitude" || h === "lat") || !hn.some(h => h === "locationid"))
              throw new Error(
                `Fabric CSV missing required columns.\n\nColumns found: ${headers.slice(0,12).join(", ")}\n\n` +
                "Upload the Broadband Serviceable Locations (BSL) CSV with columns: location_id, latitude, longitude, address_primary, …"
              );
          },
          (row, bytes) => {
            const lid = get(row, "location_id", "locationid");
            if (!fiberIds.has(lid)) return;
            const lat = parseFloat(get(row, "latitude", "lat"));
            const lng = parseFloat(get(row, "longitude", "long", "lng", "lon"));
            if (isNaN(lat) || isNaN(lng)) return;
            const sn = get(row, "address_primary", "h_address", "street_address", "address");
            const ci = get(row, "city", "city_name");
            const st = get(row, "state_usps", "state_abbr", "state");
            const zp = get(row, "zip_code", "zip", "zipcode");
            const parts = [sn, ci, (st + (zp ? " " + zp : "")).trim()].filter(Boolean);
            exactCoords.set(lid, { lat, lng, addr: parts.join(", ") || `${lat.toFixed(6)},${lng.toFixed(6)}` });
            const p = pct(bytes, fabricFile.size);
            if (p !== lastP2) { lastP2 = p; setPhase2Pct(p); }
          },
        );

        // Import Fabric-matched rows with exact coords + brand from h3Coords context
        const rows: ParsedRow[] = [];
        for (const [lid, coords] of exactCoords) {
          rows.push({ address: coords.addr, lat: coords.lat, lng: coords.lng, brand_name: "", technology: "50", max_down: null, max_up: null });
          if (rows.length >= BATCH) {
            const res = await fetch("/api/leads/import-bdc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: rows.splice(0, BATCH) }) });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Import error"); }
            const d = await res.json();
            totalImported += d.imported ?? 0; setImported(totalImported);
          }
        }
        if (rows.length > 0) {
          const res = await fetch("/api/leads/import-bdc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
          if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Final batch error"); }
          const d = await res.json();
          totalImported += d.imported ?? 0;
          totalSkipped  += fiberIds.size - totalImported;
        }

      } else {
        // ── Phase 2b: No Fabric — import using H3 cell centers ─────────
        setCoordMode("h3"); setStage("phase2");
        const pending: ParsedRow[] = [];
        let done = 0;
        const total = h3Coords.size;
        for (const [, [lat, lng]] of h3Coords) {
          pending.push({ address: `${lat.toFixed(6)},${lng.toFixed(6)}`, lat, lng, brand_name: "", technology: "50", max_down: null, max_up: null });
          done++;
          if (pending.length >= BATCH) {
            const batch = pending.splice(0, BATCH);
            const res = await fetch("/api/leads/import-bdc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: batch }) });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Import error"); }
            const d = await res.json();
            totalImported += d.imported ?? 0; totalSkipped += batch.length - (d.imported ?? 0);
            setImported(totalImported); setPhase2Pct(pct(done, total));
          }
          if (done % 5000 === 0) await new Promise(r => setTimeout(r, 0));
        }
        if (pending.length > 0) {
          const res = await fetch("/api/leads/import-bdc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: pending }) });
          if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Final batch error"); }
          const d = await res.json();
          totalImported += d.imported ?? 0; totalSkipped += pending.length - (d.imported ?? 0);
        }
      }

      setImported(totalImported); setDupSkip(totalSkipped);
      setPhase2Pct(100); setStage("done");

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed";
      const parts = msg.split(/\n\n/);
      setErrorMsg(parts[0]); setErrorDetail(parts.slice(1).join("\n\n") || null);
      setStage("error");
    }
  }

  function reset() {
    setStage("idle"); setAvailFile(null); setFabricFile(null);
    setPhase1Pct(0); setFiberIdCount(0); setPhase2Pct(0);
    setImported(0); setDupSkip(0); setErrorMsg(null); setErrorDetail(null);
    if (availRef.current)  availRef.current.value  = "";
    if (fabricRef.current) fabricRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">BDC Fiber Import</h1>
        <p className="text-sm text-gray-500 mt-1">
          Import FCC fiber availability data as leads. The Fabric file is optional but gives exact per-address coordinates.
        </p>
      </div>

      {stage === "idle" && (
        <div className="space-y-4">
          {/* Tech filter */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-2">
            <p className="text-sm font-semibold text-gray-700">Technology filter</p>
            <div className="flex gap-2">
              {(["50", "all"] as const).map(v => (
                <button key={v} onClick={() => setTechFilter(v)}
                  className={`text-sm px-4 py-2 rounded-xl font-medium transition-colors ${techFilter === v ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {v === "50" ? "Fiber only (tech 50)" : "All technologies"}
                </button>
              ))}
            </div>
          </div>

          {/* File 1: Availability (required) */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">Availability CSV <span className="text-red-500">*</span></p>
                <p className="text-xs text-gray-500">broadbandmap.fcc.gov → Data → Download → By State</p>
              </div>
              {availFile && <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-lg">✓ Ready</span>}
            </div>
            {availFile
              ? <p className="text-xs text-gray-600 truncate">{availFile.name} — {fmtMB(availFile.size)}</p>
              : <label className="flex items-center gap-2 text-sm text-blue-600 font-medium cursor-pointer hover:underline">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                  Tap to select
                  <input ref={availRef} type="file" accept=".csv,.tsv,.txt,.CSV,.TSV" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setAvailFile(f); }} />
                </label>
            }
            {availFile && <button onClick={() => { setAvailFile(null); if (availRef.current) availRef.current.value=""; }} className="text-xs text-gray-400 underline">Remove</button>}
          </div>

          {/* File 2: Fabric (optional) */}
          <div className={`rounded-2xl border px-5 py-4 space-y-2 ${fabricFile ? "border-green-200 bg-green-50" : "border-dashed border-gray-300 bg-gray-50"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  Fabric (BSL) CSV
                  <span className="ml-2 text-xs font-normal text-gray-400">optional — exact per-address dots</span>
                </p>
                <p className="text-xs text-gray-500">Requires free FCC account → Data → Broadband Serviceable Locations</p>
              </div>
              {fabricFile && <span className="text-xs font-medium text-green-700 bg-green-100 border border-green-200 px-2 py-1 rounded-lg">✓ Exact coords</span>}
            </div>
            {!fabricFile && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <p className="text-xs text-amber-700">
                  Without this file, coordinates come from H3 cell centers (~460 m accuracy) — multiple addresses share the same dot.
                </p>
              </div>
            )}
            {fabricFile
              ? <p className="text-xs text-gray-600 truncate">{fabricFile.name} — {fmtMB(fabricFile.size)}</p>
              : <label className="flex items-center gap-2 text-sm text-gray-500 font-medium cursor-pointer hover:text-gray-700">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                  Add Fabric file (optional)
                  <input ref={fabricRef} type="file" accept=".csv,.tsv,.txt,.CSV,.TSV" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setFabricFile(f); }} />
                </label>
            }
            {fabricFile && <button onClick={() => { setFabricFile(null); if (fabricRef.current) fabricRef.current.value=""; }} className="text-xs text-gray-400 underline">Remove</button>}
          </div>

          <button onClick={startImport} disabled={!availFile}
            className="w-full text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-4 py-3 rounded-xl">
            {availFile
              ? fabricFile ? "Start Import (exact coordinates) →" : "Start Import (H3 approximate) →"
              : "Select Availability file to continue"}
          </button>
        </div>
      )}

      {/* Phase 1 progress */}
      {stage === "phase1" && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0"/>
            <div>
              <p className="text-sm font-semibold text-blue-800">Phase 1 — Reading availability data…</p>
              <p className="text-xs text-blue-600 truncate">{availFile?.name}</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-blue-700 font-medium">
              <span>{phase1Pct}% read</span>
              <span>{fiberIdCount.toLocaleString()} fiber IDs found</span>
            </div>
            <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{width:`${phase1Pct}%`}}/>
            </div>
          </div>
          <p className="text-xs text-blue-400 text-center">Do not close this page.</p>
        </div>
      )}

      {/* Phase 2 progress */}
      {stage === "phase2" && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0"/>
            <div>
              <p className="text-sm font-semibold text-blue-800">
                {coordMode === "exact" ? "Phase 2 — Importing exact locations…" : "Phase 2 — Importing (H3 approximate)…"}
              </p>
              <p className="text-xs text-blue-600">{fiberIdCount.toLocaleString()} fiber locations to process</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-blue-700 font-medium">
              <span>{phase2Pct}% done</span>
              <span>{imported.toLocaleString()} imported</span>
            </div>
            <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{width:`${phase2Pct}%`}}/>
            </div>
          </div>
          <p className="text-xs text-blue-400 text-center">Do not close this page.</p>
        </div>
      )}

      {/* Done */}
      {stage === "done" && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
              </svg>
            </div>
            <div>
              <p className="text-base font-bold text-green-800">Import complete</p>
              <p className="text-sm text-green-700">
                {imported.toLocaleString()} locations added.
                {dupSkip > 0 ? ` ${dupSkip.toLocaleString()} duplicates skipped.` : ""}
              </p>
              {coordMode === "h3" && (
                <p className="text-xs text-amber-700 mt-1">
                  Coordinates are H3 cell centers (~460 m). Re-import with the Fabric file for exact per-address dots.
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <a href="/map" className="flex-1 text-center text-sm font-bold text-white bg-green-600 hover:bg-green-700 px-4 py-2.5 rounded-xl">View on Map →</a>
            <button onClick={reset} className="text-sm text-gray-600 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50">Import another</button>
          </div>
        </div>
      )}

      {/* Error */}
      {stage === "error" && (
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 px-5 py-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-red-800">Import failed</p>
              <p className="text-sm text-red-700 mt-1 whitespace-pre-wrap">{errorMsg}</p>
            </div>
          </div>
          {errorDetail && <div className="bg-white rounded-xl border border-red-200 px-4 py-3"><p className="text-xs text-red-600 whitespace-pre-wrap">{errorDetail}</p></div>}
          <button onClick={reset} className="w-full text-sm font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-xl">Start over</button>
        </div>
      )}
    </div>
  );
}
