"use client";

import { useRef, useState } from "react";

// ── BDC column name normalizer ─────────────────────────────────────────────
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

// ── Lightweight CSV parser (handles quoted fields) ─────────────────────────
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

const BATCH      = 2000;
const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB per read

type Stage = "idle" | "reading_avail" | "importing" | "done" | "error";

function fmtMB(b: number) { return (b / 1_048_576).toFixed(0) + " MB"; }
function pct(n: number, total: number) { return total > 0 ? Math.min(99, Math.round((n / total) * 100)) : 0; }

// ── Generic streaming CSV reader ──────────────────────────────────────────
// Reads `file` in CHUNK_SIZE slices, calls onHeaders once then onLine for
// each data row. onLine may be async (will be awaited). Throws on read error.
async function streamCSV(
  file: File,
  onHeaders: (headers: string[]) => void,
  onLine: (row: Record<string, string>, bytesRead: number) => void | Promise<void>,
): Promise<void> {
  const decoder  = new TextDecoder("utf-8");
  let lineBuf    = "";
  let headers: string[] | null = null;
  let bytesRead  = 0;
  let firstChunk = true;

  for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
    const slice = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size));

    const ab = await new Promise<ArrayBuffer>((res, rej) => {
      const fr = new FileReader();
      fr.onload  = (e) => res(e.target!.result as ArrayBuffer);
      fr.onerror = ()  => rej(new Error("File read error"));
      fr.readAsArrayBuffer(slice);
    });

    let text = decoder.decode(new Uint8Array(ab), { stream: true });
    bytesRead += ab.byteLength;

    if (firstChunk) {
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
      firstChunk = false;
    }

    lineBuf += text;
    const lastNL = lineBuf.lastIndexOf("\n");
    if (lastNL === -1) continue;

    const complete = lineBuf.slice(0, lastNL + 1);
    lineBuf = lineBuf.slice(lastNL + 1);

    for (const rawLine of complete.split("\n")) {
      const line = rawLine.replace(/\r$/, "").trim();
      if (!line) continue;

      if (headers === null) {
        headers = parseCSVLine(line);
        onHeaders(headers); // may throw
        continue;
      }

      const row: Record<string, string> = {};
      parseCSVLine(line).forEach((v, i) => { row[headers![i]] = v; });
      await onLine(row, bytesRead); // may throw
    }

    await new Promise((r) => setTimeout(r, 0)); // yield to browser
  }

  // flush last partial line
  if (lineBuf.trim() && headers !== null) {
    const row: Record<string, string> = {};
    parseCSVLine(lineBuf.replace(/\r$/, "")).forEach((v, i) => { row[headers![i]] = v; });
    await onLine(row, file.size);
  }
}

export default function BDCImporter() {
  const availRef  = useRef<HTMLInputElement>(null);
  const fabricRef = useRef<HTMLInputElement>(null);

  const [availFile,  setAvailFile]  = useState<File | null>(null);
  const [fabricFile, setFabricFile] = useState<File | null>(null);
  const [techFilter, setTechFilter] = useState<"50" | "all">("50");

  const [stage,          setStage]         = useState<Stage>("idle");
  const [availPct,       setAvailPct]      = useState(0);
  const [availFiberCount, setAvailFiberCount] = useState(0);
  const [fabricPct,      setFabricPct]     = useState(0);
  const [imported,       setImported]      = useState(0);
  const [dupSkip,        setDupSkip]       = useState(0);
  const [errorMsg,       setErrorMsg]      = useState<string | null>(null);
  const [errorDetail,    setErrorDetail]   = useState<string | null>(null);

  // ── Main import: Phase 1 = collect fiber location_ids from Availability CSV
  //               Phase 2 = stream Fabric CSV, import rows whose ID is in set ──
  async function startImport() {
    if (!availFile || !fabricFile) return;

    const currentFilter = techFilter;
    const fiberIds      = new Set<string>();
    let totalImported   = 0;
    let totalSkipped    = 0;

    try {
      // ── Phase 1: Availability CSV ─────────────────────────────────────
      setStage("reading_avail");
      setAvailPct(0);
      setAvailFiberCount(0);

      let lastAvailPct = 0;

      await streamCSV(
        availFile,
        (headers) => {
          const hn = headers.map(norm);
          if (!hn.some((h) => h === "locationid")) {
            throw new Error(
              `This file is missing a "location_id" column.\n\n` +
              `Columns found: ${headers.slice(0, 10).join(", ")}\n\n` +
              "Upload the Fixed Broadband Availability CSV for your state " +
              "(the one with columns like frn, provider_id, technology, …)."
            );
          }
        },
        (row, bytesRead) => {
          const tech = get(row, "technology");
          if (currentFilter !== "50" || tech === "50") {
            const lid = get(row, "location_id", "locationid");
            if (lid) fiberIds.add(lid);
          }
          const p = pct(bytesRead, availFile.size);
          if (p !== lastAvailPct) {
            lastAvailPct = p;
            setAvailPct(p);
            setAvailFiberCount(fiberIds.size);
          }
        },
      );

      setAvailPct(100);
      setAvailFiberCount(fiberIds.size);

      if (fiberIds.size === 0) {
        throw new Error(
          `No ${currentFilter === "50" ? "fiber (technology 50) " : ""}locations found in the Availability file.\n\n` +
          "Make sure you chose the Fixed Broadband Availability CSV and that it contains rows with technology = 50."
        );
      }

      // ── Phase 2: Fabric CSV → import matching locations ────────────────
      setStage("importing");
      setFabricPct(0);

      const pending: ParsedRow[] = [];
      let lastFabricPct = 0;

      await streamCSV(
        fabricFile,
        (headers) => {
          const hn = headers.map(norm);
          const hasLat = hn.some((h) => h === "latitude" || h === "lat");
          const hasId  = hn.some((h) => h === "locationid");
          if (!hasLat || !hasId) {
            throw new Error(
              `This file is missing ${!hasId ? '"location_id"' : ""} ${!hasLat ? '"latitude"' : ""} column(s).\n\n` +
              `Columns found: ${headers.slice(0, 10).join(", ")}\n\n` +
              "Upload the Fabric (BSL) CSV — the one with columns like " +
              "location_id, latitude, longitude, address_primary, city, …"
            );
          }
        },
        async (row, bytesRead) => {
          const lid = get(row, "location_id", "locationid");
          if (!fiberIds.has(lid)) return; // not a fiber location — skip

          const lat = parseFloat(get(row, "latitude", "lat"));
          const lng = parseFloat(get(row, "longitude", "long", "lng", "lon"));
          if (isNaN(lat) || isNaN(lng)) return;

          const streetNum = get(row, "address_primary", "h_address", "street_address", "address");
          const city      = get(row, "city", "city_name");
          const stateAbbr = get(row, "state_usps", "state_abbr", "state");
          const zip       = get(row, "zip_code", "zip", "zipcode", "postal_code");
          const addrParts = [streetNum, city, (stateAbbr + (zip ? " " + zip : "")).trim()].filter(Boolean);
          const addr      = addrParts.length > 0 ? addrParts.join(", ") : `${lat.toFixed(6)},${lng.toFixed(6)}`;

          pending.push({
            address:    addr,
            lat,
            lng,
            brand_name: "",
            technology: "50",
            max_down:   null,
            max_up:     null,
          });

          if (pending.length >= BATCH) {
            const batch = pending.splice(0, BATCH);
            const res   = await fetch("/api/leads/import-bdc", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ rows: batch }),
            });
            if (!res.ok) {
              const d = await res.json();
              throw new Error(d.error ?? "Server error during import");
            }
            const d = await res.json();
            totalImported += d.imported ?? 0;
            totalSkipped  += batch.length - (d.imported ?? 0);
            setImported(totalImported);
          }

          const p = pct(bytesRead, fabricFile.size);
          if (p !== lastFabricPct) {
            lastFabricPct = p;
            setFabricPct(p);
          }
        },
      );

      // flush remainder
      if (pending.length > 0) {
        const res = await fetch("/api/leads/import-bdc", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ rows: pending }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error ?? "Final batch failed");
        }
        const d = await res.json();
        totalImported += d.imported ?? 0;
        totalSkipped  += pending.length - (d.imported ?? 0);
      }

      setImported(totalImported);
      setDupSkip(totalSkipped);
      setFabricPct(100);
      setStage("done");

    } catch (err) {
      const msg   = err instanceof Error ? err.message : "Import failed";
      const parts = msg.split(/\n\n/);
      setErrorMsg(parts[0]);
      setErrorDetail(parts.slice(1).join("\n\n") || null);
      setStage("error");
    }
  }

  function reset() {
    setStage("idle");
    setAvailFile(null);
    setFabricFile(null);
    setAvailPct(0);
    setAvailFiberCount(0);
    setFabricPct(0);
    setImported(0);
    setDupSkip(0);
    setErrorMsg(null);
    setErrorDetail(null);
    if (availRef.current)  availRef.current.value  = "";
    if (fabricRef.current) fabricRef.current.value = "";
  }

  const canStart = availFile !== null && fabricFile !== null;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">BDC Fiber Import</h1>
        <p className="text-sm text-gray-500 mt-1">
          The FCC provides fiber data across two separate files.
          Upload both below — they will be joined automatically.
        </p>
      </div>

      {/* Instructions */}
      <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm space-y-3">
        <div>
          <p className="font-semibold text-blue-800">File 1 — Availability CSV</p>
          <p className="text-blue-700 mt-0.5">Has the technology data (which locations have fiber) but no coordinates.</p>
          <ol className="list-decimal list-inside text-blue-600 mt-1 space-y-0.5">
            <li>Go to <strong>broadbandmap.fcc.gov → Data → Download</strong></li>
            <li>Click <strong>By State → select your state</strong></li>
            <li>Download <strong>Fixed Broadband — Availability</strong></li>
          </ol>
        </div>
        <div className="border-t border-blue-100 pt-3">
          <p className="font-semibold text-blue-800">File 2 — Fabric CSV</p>
          <p className="text-blue-700 mt-0.5">Has the lat/lng and address for every broadband-serviceable location.</p>
          <ol className="list-decimal list-inside text-blue-600 mt-1 space-y-0.5">
            <li>Same page → <strong>Fabric → By State → select your state</strong></li>
            <li>Download <strong>Broadband Serviceable Location Fabric</strong></li>
          </ol>
        </div>
      </div>

      {/* Idle: pickers + filter */}
      {stage === "idle" && (
        <div className="space-y-4">
          {/* Tech filter */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-2">
            <p className="text-sm font-semibold text-gray-700">Technology filter</p>
            <div className="flex gap-2">
              {(["50", "all"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setTechFilter(v)}
                  className={`text-sm px-4 py-2 rounded-xl font-medium transition-colors ${
                    techFilter === v ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {v === "50" ? "Fiber only (tech 50)" : "All technologies"}
                </button>
              ))}
            </div>
          </div>

          {/* File 1: Availability */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">File 1 — Availability CSV</p>
                <p className="text-xs text-gray-500">Columns: frn, provider_id, technology, …</p>
              </div>
              {availFile && (
                <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-lg">
                  ✓ Selected
                </span>
              )}
            </div>
            {availFile ? (
              <p className="text-xs text-gray-600 truncate">{availFile.name} — {fmtMB(availFile.size)}</p>
            ) : (
              <label className="flex items-center gap-2 text-sm text-blue-600 font-medium cursor-pointer hover:underline">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Tap to select
                <input ref={availRef} type="file" accept=".csv,.CSV" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setAvailFile(f); }} />
              </label>
            )}
            {availFile && (
              <button onClick={() => { setAvailFile(null); if (availRef.current) availRef.current.value = ""; }}
                className="text-xs text-gray-400 underline">Remove</button>
            )}
          </div>

          {/* File 2: Fabric */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">File 2 — Fabric CSV</p>
                <p className="text-xs text-gray-500">Columns: location_id, latitude, longitude, address, …</p>
              </div>
              {fabricFile && (
                <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-lg">
                  ✓ Selected
                </span>
              )}
            </div>
            {fabricFile ? (
              <p className="text-xs text-gray-600 truncate">{fabricFile.name} — {fmtMB(fabricFile.size)}</p>
            ) : (
              <label className="flex items-center gap-2 text-sm text-blue-600 font-medium cursor-pointer hover:underline">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Tap to select
                <input ref={fabricRef} type="file" accept=".csv,.CSV" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setFabricFile(f); }} />
              </label>
            )}
            {fabricFile && (
              <button onClick={() => { setFabricFile(null); if (fabricRef.current) fabricRef.current.value = ""; }}
                className="text-xs text-gray-400 underline">Remove</button>
            )}
          </div>

          <button
            onClick={startImport}
            disabled={!canStart}
            className="w-full text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-4 py-3 rounded-xl"
          >
            {canStart ? "Start Import →" : "Select both files to continue"}
          </button>
        </div>
      )}

      {/* Phase 1: reading availability */}
      {stage === "reading_avail" && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Phase 1 of 2 — Reading availability data…</p>
              <p className="text-xs text-blue-600">{availFile?.name}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-blue-700 font-medium">
              <span>{availPct}% read</span>
              <span>{availFiberCount.toLocaleString()} fiber IDs found</span>
            </div>
            <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${availPct}%` }} />
            </div>
          </div>
          <p className="text-xs text-blue-400 text-center">Do not close this page.</p>
        </div>
      )}

      {/* Phase 2: importing via fabric */}
      {stage === "importing" && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Phase 2 of 2 — Importing locations…</p>
              <p className="text-xs text-blue-600">{fabricFile?.name}</p>
            </div>
          </div>
          <div className="rounded-lg bg-blue-100 px-3 py-2 text-xs text-blue-700">
            Matched against {availFiberCount.toLocaleString()} fiber location IDs from availability file
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-blue-700 font-medium">
              <span>{fabricPct}% of fabric read</span>
              <span>{imported.toLocaleString()} imported</span>
            </div>
            <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${fabricPct}%` }} />
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <p className="text-base font-bold text-green-800">Import complete</p>
              <p className="text-sm text-green-700">
                {imported.toLocaleString()} fiber locations added to your leads pool.
                {dupSkip > 0 ? ` ${dupSkip.toLocaleString()} duplicates skipped.` : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <a href="/map"
              className="flex-1 text-center text-sm font-bold text-white bg-green-600 hover:bg-green-700 px-4 py-2.5 rounded-xl">
              View on Map →
            </a>
            <button onClick={reset}
              className="text-sm text-gray-600 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50">
              Import another
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {stage === "error" && (
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 px-5 py-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-red-800">Import failed</p>
              <p className="text-sm text-red-700 mt-1 whitespace-pre-wrap">{errorMsg}</p>
            </div>
          </div>
          {errorDetail && (
            <div className="bg-white rounded-xl border border-red-200 px-4 py-3">
              <p className="text-xs text-red-600 whitespace-pre-wrap">{errorDetail}</p>
            </div>
          )}
          <button onClick={reset}
            className="w-full text-sm font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-xl">
            Start over
          </button>
        </div>
      )}
    </div>
  );
}
