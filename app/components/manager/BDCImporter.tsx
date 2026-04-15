"use client";

import { useRef, useState } from "react";

// ── BDC column name normalizer ─────────────────────────────────────────────
// Strips UTF-8 BOM (U+FEFF) that many FCC/government CSVs include
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
const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB per FileReader read

type Stage = "idle" | "importing" | "done" | "error";

function fmtMB(bytes: number) { return (bytes / 1_048_576).toFixed(0) + " MB"; }
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
  // Reads the file in 8 MB chunks, parses lines on the fly, and POSTs
  // each batch of 2000 rows to the API immediately — peak memory is ~10 MB
  // regardless of file size. Handles 848 MB+ files on mobile.
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
      setErrorDetail(
        "On iPhone: tap the ZIP in Files to expand it, then upload the .csv file inside."
      );
      setStage("error");
      return;
    }

    const decoder      = new TextDecoder("utf-8");
    const currentFilter = techFilter; // capture at start
    let lineBuffer     = "";
    let headers: string[] | null = null;
    let pending: ParsedRow[] = [];
    let totalImported  = 0;
    let totalSkipped   = 0;
    let totalBytes     = 0;
    let firstChunk     = true;
    let batchNum       = 0;

    try {
      for (let offset = 0; offset < f.size; offset += CHUNK_SIZE) {
        const slice = f.slice(offset, Math.min(offset + CHUNK_SIZE, f.size));

        // Read chunk via FileReader (most compatible, works on all iOS versions)
        const ab = await new Promise<ArrayBuffer>((res, rej) => {
          const fr = new FileReader();
          fr.onload  = (e) => res(e.target!.result as ArrayBuffer);
          fr.onerror = ()  => rej(new Error("File read error"));
          fr.readAsArrayBuffer(slice);
        });

        let text = decoder.decode(new Uint8Array(ab), { stream: true });
        totalBytes += ab.byteLength;

        // Strip BOM from very first chunk
        if (firstChunk) {
          if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
          firstChunk = false;
        }

        lineBuffer += text;

        // Find last complete newline so we never split a line across chunks
        const lastNL = lineBuffer.lastIndexOf("\n");
        if (lastNL === -1) continue;

        const complete  = lineBuffer.slice(0, lastNL + 1);
        lineBuffer      = lineBuffer.slice(lastNL + 1);

        for (let rawLine of complete.split("\n")) {
          const line = rawLine.replace(/\r$/, "").trim();
          if (!line) continue;

          // First non-empty line is the header row
          if (headers === null) {
            headers = parseCSVLine(line);
            const hn = headers.map(norm);
            if (!hn.some((h) => h === "latitude" || h === "lat")) {
              throw new Error(
                `Could not find a "latitude" column.\n\n` +
                `Columns found (first 10): ${headers.slice(0, 10).join(", ")}\n\n` +
                "Make sure this is the Fixed Broadband Availability CSV, not a coverage or summary file."
              );
            }
            continue;
          }

          const cells: Record<string, string> = {};
          parseCSVLine(line).forEach((v, i) => { cells[headers![i]] = v; });

          // Apply technology filter
          const technology = get(cells, "technology");
          if (currentFilter === "50" && technology !== "50") continue;

          const lat = parseFloat(get(cells, "latitude", "lat"));
          const lng = parseFloat(get(cells, "longitude", "long", "lng", "lon"));
          if (isNaN(lat) || isNaN(lng)) continue;

          const streetNum = get(cells, "address_primary", "h_address", "street_address", "address", "location_address");
          const city      = get(cells, "city", "city_name");
          const stateAbbr = get(cells, "state_abbr", "state");
          const zip       = get(cells, "zip_code", "zip", "zipcode", "postal_code");
          const addrParts = [streetNum, city, (stateAbbr + (zip ? " " + zip : "")).trim()].filter(Boolean);
          const addr      = addrParts.length > 0 ? addrParts.join(", ") : `${lat.toFixed(6)},${lng.toFixed(6)}`;

          pending.push({
            address: addr, lat, lng, technology,
            brand_name: get(cells, "brand_name", "brandname", "provider", "provider_name"),
            max_down:   parseFloat(get(cells, "max_advertised_download_speed", "max_download_speed", "maxdown")) || null,
            max_up:     parseFloat(get(cells, "max_advertised_upload_speed",   "max_upload_speed",   "maxup"))   || null,
          });

          // Flush a batch when full
          if (pending.length >= BATCH) {
            batchNum++;
            const batch = pending.splice(0, BATCH);
            const res  = await fetch("/api/leads/import-bdc", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ rows: batch }),
            });
            if (!res.ok) {
              const d = await res.json();
              throw new Error(d.error ?? `Server error on batch ${batchNum}`);
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

      // Flush any remaining rows
      if (pending.length > 0) {
        const res  = await fetch("/api/leads/import-bdc", {
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
      const msg    = err instanceof Error ? err.message : "Import failed";
      const parts  = msg.split(/\n\n/);
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

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">BDC Fiber Import</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload the FCC Broadband Data Collection fixed-availability CSV for your state.
          Rows are streamed and imported in real-time — large files (500 MB+) are fully supported.
        </p>
      </div>

      {/* Instructions */}
      <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800 space-y-1">
        <p className="font-semibold">Where to download the file:</p>
        <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
          <li>Go to <strong>broadbandmap.fcc.gov → Data → Download</strong></li>
          <li>Click <strong>By State</strong></li>
          <li>Select your state</li>
          <li>Download <strong>Fixed Broadband — Availability</strong> CSV</li>
          <li>If it downloads as a ZIP, extract it first, then upload the .csv inside</li>
        </ol>
      </div>

      {/* Idle: filter + file picker */}
      {stage === "idle" && (
        <div className="space-y-4">
          {/* Technology filter — set BEFORE picking file */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-2">
            <p className="text-sm font-semibold text-gray-700">Technology filter</p>
            <p className="text-xs text-gray-500">Choose before selecting the file.</p>
            <div className="flex gap-2 pt-1">
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
              <p className="text-sm font-semibold text-gray-700">Tap to select BDC CSV file</p>
              <p className="text-xs text-gray-400 mt-1">Streams large files without loading them fully into memory</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.zip,.CSV"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) streamImport(f); }}
            />
          </label>
        </div>
      )}

      {/* Importing — streaming progress */}
      {stage === "importing" && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-blue-800 truncate">{fileName}</p>
              {fileSize > 0 && (
                <p className="text-xs text-blue-600">{fmtMB(fileSize)} file</p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-blue-700 font-medium">
              <span>{readPct}% read</span>
              <span>{imported.toLocaleString()} imported</span>
            </div>
            <div className="h-3 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${readPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-blue-500">
              <span>{fmtMB(bytesRead)} of {fmtMB(fileSize)}</span>
              <span>{techFilter === "50" ? "Fiber only" : "All tech"}</span>
            </div>
          </div>

          <p className="text-xs text-blue-400 text-center">Do not close this page — import is in progress.</p>
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
                {imported.toLocaleString()} new locations added to your leads pool.
                {dupSkip > 0 ? ` ${dupSkip.toLocaleString()} duplicates skipped.` : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <a
              href="/map"
              className="flex-1 text-center text-sm font-bold text-white bg-green-600 hover:bg-green-700 px-4 py-2.5 rounded-xl"
            >
              View on Map →
            </a>
            <button
              onClick={reset}
              className="text-sm text-gray-600 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50"
            >
              Import another
            </button>
          </div>
        </div>
      )}

      {/* Error — large and unmissable */}
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
          <button
            onClick={reset}
            className="w-full text-sm font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-xl"
          >
            Try a different file
          </button>
        </div>
      )}
    </div>
  );
}
