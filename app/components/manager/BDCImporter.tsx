"use client";

import { useRef, useState } from "react";
import { cellToLatLng } from "h3-js";

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

// ── Auto-detect delimiter from first line (tab vs comma) ──────────────────
function detectDelimiter(line: string): string {
  const tabs   = (line.match(/\t/g)  ?? []).length;
  const commas = (line.match(/,/g)   ?? []).length;
  return tabs > commas ? "\t" : ",";
}

// ── CSV line parser (handles quoted fields for comma mode) ─────────────────
function parseLine(line: string, delimiter: string): string[] {
  if (delimiter === "\t") return line.split("\t");   // TSV: no quoting needed
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

// ── Decode H3 cell ID → [lat, lng] center, returns null on failure ─────────
function h3ToLatLng(h3id: string): [number, number] | null {
  try {
    const [lat, lng] = cellToLatLng(h3id);
    if (isNaN(lat) || isNaN(lng)) return null;
    return [lat, lng];
  } catch {
    return null;
  }
}

const BATCH      = 2000;
const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB per read

type Stage = "idle" | "importing" | "done" | "error";

function fmtMB(b: number) { return (b / 1_048_576).toFixed(0) + " MB"; }
function pct(n: number, total: number) { return total > 0 ? Math.min(99, Math.round((n / total) * 100)) : 0; }

export default function BDCImporter() {
  const fileRef     = useRef<HTMLInputElement>(null);
  const [stage,     setStage]     = useState<Stage>("idle");
  const [fileName,  setFileName]  = useState("");
  const [fileSize,  setFileSize]  = useState(0);
  const [techFilter, setTechFilter] = useState<"50" | "all">("50");
  const [bytesRead, setBytesRead] = useState(0);
  const [imported,  setImported]  = useState(0);
  const [dupSkip,   setDupSkip]   = useState(0);
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  // ── Streaming parse + import pipeline ──────────────────────────────────
  async function streamImport(f: File) {
    setFileName(f.name);
    setFileSize(f.size);
    setBytesRead(0);
    setImported(0);
    setDupSkip(0);
    setErrorMsg(null);
    setErrorDetail(null);
    setStage("importing");

    if (
      f.name.toLowerCase().endsWith(".zip") ||
      f.type === "application/zip" ||
      f.type === "application/x-zip-compressed"
    ) {
      setErrorMsg("This is a ZIP file — please extract it first.");
      setErrorDetail("On iPhone: tap the ZIP in Files to expand it, then upload the .csv or .txt file inside.");
      setStage("error");
      return;
    }

    const decoder       = new TextDecoder("utf-8");
    const currentFilter = techFilter;
    let lineBuffer      = "";
    let headers: string[] | null = null;
    let delimiter       = ",";
    let pending: ParsedRow[] = [];
    let totalImported   = 0;
    let totalSkipped    = 0;
    let totalBytes      = 0;
    let firstChunk      = true;

    try {
      for (let offset = 0; offset < f.size; offset += CHUNK_SIZE) {
        const slice = f.slice(offset, Math.min(offset + CHUNK_SIZE, f.size));

        const ab = await new Promise<ArrayBuffer>((res, rej) => {
          const fr = new FileReader();
          fr.onload  = (e) => res(e.target!.result as ArrayBuffer);
          fr.onerror = ()  => rej(new Error("File read error"));
          fr.readAsArrayBuffer(slice);
        });

        let text = decoder.decode(new Uint8Array(ab), { stream: true });
        totalBytes += ab.byteLength;

        if (firstChunk) {
          if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
          firstChunk = false;
        }

        lineBuffer += text;
        const lastNL = lineBuffer.lastIndexOf("\n");
        if (lastNL === -1) continue;

        const complete = lineBuffer.slice(0, lastNL + 1);
        lineBuffer     = lineBuffer.slice(lastNL + 1);

        for (const rawLine of complete.split("\n")) {
          const line = rawLine.replace(/\r$/, "").trim();
          if (!line) continue;

          // First line: detect delimiter + parse headers
          if (headers === null) {
            delimiter = detectDelimiter(line);
            headers   = parseLine(line, delimiter).map((h) => h.trim());

            const hn        = headers.map(norm);
            const hasLat    = hn.some((h) => h === "latitude" || h === "lat");
            const hasH3     = hn.some((h) => h === "h3res8id" || h === "h3res8");
            const hasLocId  = hn.some((h) => h === "locationid");

            if (!hasLat && !hasH3 && !hasLocId) {
              throw new Error(
                `Could not find location columns (latitude, h3_res8_id, or location_id).\n\n` +
                `Columns found: ${headers.slice(0, 12).join(", ")}\n\n` +
                "Upload the Fixed Broadband Availability CSV — the one with columns like " +
                "frn, provider_id, brand_name, location_id, technology, …"
              );
            }
            continue;
          }

          const cells: Record<string, string> = {};
          parseLine(line, delimiter).forEach((v, i) => { cells[headers![i]] = v.trim(); });

          // Technology filter
          const technology = get(cells, "technology");
          if (currentFilter === "50" && technology !== "50") continue;

          // ── Get coordinates: prefer explicit lat/lng, fall back to H3 ──
          let lat = parseFloat(get(cells, "latitude", "lat"));
          let lng = parseFloat(get(cells, "longitude", "long", "lng", "lon"));

          if (isNaN(lat) || isNaN(lng)) {
            const h3id = get(cells, "h3_res8_id", "h3res8id", "h3res8");
            if (h3id) {
              const coords = h3ToLatLng(h3id);
              if (!coords) continue;
              [lat, lng] = coords;
            } else {
              continue; // no usable coordinates
            }
          }

          // Build address from available columns
          const streetNum = get(cells, "address_primary", "h_address", "street_address", "address", "location_address");
          const city      = get(cells, "city", "city_name");
          const stateAbbr = get(cells, "state_usps", "state_abbr", "state");
          const zip       = get(cells, "zip_code", "zip", "zipcode", "postal_code");
          const addrParts = [streetNum, city, (stateAbbr + (zip ? " " + zip : "")).trim()].filter(Boolean);
          const addr      = addrParts.length > 0
            ? addrParts.join(", ")
            : `${lat.toFixed(6)},${lng.toFixed(6)}`;

          pending.push({
            address:    addr,
            lat,
            lng,
            technology,
            brand_name: get(cells, "brand_name", "brandname", "provider", "provider_name"),
            max_down:   parseFloat(get(cells, "max_advertised_download_speed", "max_download_speed", "maxdown")) || null,
            max_up:     parseFloat(get(cells, "max_advertised_upload_speed",   "max_upload_speed",   "maxup"))   || null,
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
        }

        setBytesRead(totalBytes);
        await new Promise((r) => setTimeout(r, 0)); // yield to browser
      }

      // Flush remainder
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
      setBytesRead(f.size);
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
    setFileName("");
    setFileSize(0);
    setBytesRead(0);
    setImported(0);
    setErrorMsg(null);
    setErrorDetail(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const readPct = pct(bytesRead, fileSize);

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">BDC Fiber Import</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload your FCC Fixed Broadband Availability file. Coordinates are decoded
          automatically from the H3 cell ID — no second file needed.
        </p>
      </div>

      {/* Instructions */}
      <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800 space-y-1">
        <p className="font-semibold">How to download the file:</p>
        <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
          <li>Go to <strong>broadbandmap.fcc.gov → Data → Download</strong></li>
          <li>Click <strong>By State → select your state</strong></li>
          <li>Download <strong>Fixed Broadband — Availability</strong></li>
          <li>Extract the ZIP if needed, then upload the CSV/TSV file here</li>
        </ol>
        <p className="text-xs text-blue-600 pt-1">
          Supports both comma-separated (.csv) and tab-separated (.tsv) formats.
          Location coordinates are decoded from the <code>h3_res8_id</code> column (~460 m accuracy).
        </p>
      </div>

      {/* Idle: filter + picker */}
      {stage === "idle" && (
        <div className="space-y-4">
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

          <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-10 cursor-pointer hover:bg-gray-100 transition-colors">
            <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700">Tap to select BDC Availability file</p>
              <p className="text-xs text-gray-400 mt-1">CSV or TSV · streams large files without memory issues</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt,.CSV,.TSV"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) streamImport(f); }}
            />
          </label>
        </div>
      )}

      {/* Importing progress */}
      {stage === "importing" && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-blue-800 truncate">{fileName}</p>
              {fileSize > 0 && <p className="text-xs text-blue-600">{fmtMB(fileSize)} file</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-blue-700 font-medium">
              <span>{readPct}% read</span>
              <span>{imported.toLocaleString()} imported</span>
            </div>
            <div className="h-3 bg-blue-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${readPct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-blue-500">
              <span>{fmtMB(bytesRead)} of {fmtMB(fileSize)}</span>
              <span>{techFilter === "50" ? "Fiber only" : "All tech"} · H3 coords</span>
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
