"use client";

import { useRef, useState } from "react";

// ── BDC column name normalizer ─────────────────────────────────────────────
// Strips UTF-8 BOM (U+FEFF) that many FCC/government CSVs include on the first column
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

const BATCH = 2000;

type Stage = "idle" | "parsing" | "importing" | "done" | "error";

export default function BDCImporter() {
  const fileRef    = useRef<HTMLInputElement>(null);
  const [stage,    setStage]    = useState<Stage>("idle");
  const [file,     setFile]     = useState<File | null>(null);
  const [fileSize, setFileSize] = useState(0);
  const [parsed,   setParsed]   = useState<ParsedRow[] | null>(null);
  const [parsedCount, setParsedCount] = useState(0);
  const [linesRead,   setLinesRead]   = useState(0);
  const [techFilter, setTechFilter] = useState<"50" | "all">("50");
  const [progress, setProgress] = useState({ step: 0, total: 0, imported: 0, parseRow: 0 });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [dupSkip,  setDupSkip]  = useState(0);

  function fmt(n: number) { return (n / 1_048_576).toFixed(1) + " MB"; }

  // ── Step 1: parse file client-side ──────────────────────────────────────
  async function handleFile(f: File) {
    setFile(f);
    setFileSize(f.size);
    setStage("parsing");
    setErrorMsg(null);
    setErrorDetail(null);
    setParsed(null);
    setParsedCount(0);
    setLinesRead(0);

    // Detect ZIP — BDC downloads come as ZIP, must extract first
    if (
      f.name.toLowerCase().endsWith(".zip") ||
      f.type === "application/zip" ||
      f.type === "application/x-zip-compressed"
    ) {
      setErrorMsg("This is a ZIP file — please extract it first.");
      setErrorDetail(
        "On iPhone: tap and hold the ZIP in Files → Quick Look, or tap once to expand it. Then re-upload the .csv file inside."
      );
      setStage("error");
      return;
    }

    try {
      let text = await f.text();
      // Strip UTF-8 BOM (U+FEFF) — many FCC government CSVs include this on byte 0
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

      const lines = text.split(/\r?\n/);
      if (lines.length < 2) {
        throw new Error("File appears empty — fewer than 2 lines found.");
      }

      const headers = parseCSVLine(lines[0]);
      const headerNorms = headers.map(norm);

      // Must have lat/lng at minimum
      const hasLatLng = headerNorms.some((h) => h === "latitude" || h === "lat");
      if (!hasLatLng) {
        throw new Error(
          `Could not find a "latitude" column.\n\n` +
          `Columns found in this file (first 10):\n  ${headers.slice(0, 10).join(", ")}\n\n` +
          "This does not look like the FCC Fixed Broadband Availability CSV. " +
          "Make sure you downloaded the Availability file (not Coverage or Summary)."
        );
      }

      const rows: ParsedRow[] = [];
      const total = lines.length - 1;
      const CHUNK = 5000;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cells = parseCSVLine(line);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = cells[idx] ?? ""; });

        const lat = parseFloat(get(row, "latitude", "lat"));
        const lng = parseFloat(get(row, "longitude", "long", "lng", "lon"));
        if (isNaN(lat) || isNaN(lng)) continue;

        // Build address from whatever columns exist
        // Most BDC availability files only have coordinates — no address text
        const streetNum = get(row, "address_primary", "h_address", "street_address", "address", "location_address");
        const city      = get(row, "city", "city_name");
        const stateAbbr = get(row, "state_abbr", "state");
        const zip       = get(row, "zip_code", "zip", "zipcode", "postal_code");
        const addrParts = [streetNum, city, (stateAbbr + (zip ? " " + zip : "")).trim()].filter(Boolean);
        // Fall back to coordinates as address when no text address in file
        const addr = addrParts.length > 0 ? addrParts.join(", ") : `${lat.toFixed(6)},${lng.toFixed(6)}`;

        rows.push({
          address:    addr,
          lat,
          lng,
          brand_name: get(row, "brand_name", "brandname", "provider", "provider_name"),
          technology: get(row, "technology"),
          max_down:   parseFloat(get(row, "max_advertised_download_speed", "max_download_speed", "maxdown")) || null,
          max_up:     parseFloat(get(row, "max_advertised_upload_speed",   "max_upload_speed",   "maxup"))   || null,
        });

        // Yield to browser every CHUNK rows to keep UI alive on mobile
        if (i % CHUNK === 0) {
          setLinesRead(i);
          setParsedCount(rows.length);
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      if (rows.length === 0) {
        throw new Error(
          `Parsed ${total.toLocaleString()} lines but found 0 valid coordinate rows.\n\n` +
          `Columns detected: ${headers.slice(0, 10).join(", ")}\n\n` +
          "Every row was skipped because lat/lng values could not be read. " +
          "Make sure this is the Fixed Broadband Availability CSV (not a summary or coverage file)."
        );
      }

      setParsed(rows);
      setParsedCount(rows.length);
      setLinesRead(total);
      setStage("idle");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Parse failed";
      // Split on first blank line — first paragraph = headline, rest = detail
      const parts = msg.split(/\n\n/);
      setErrorMsg(parts[0]);
      setErrorDetail(parts.slice(1).join("\n\n") || null);
      setStage("error");
    }
  }

  // Apply filters
  const filtered = (parsed ?? []).filter((r) => {
    if (techFilter === "50" && r.technology !== "50") return false;
    return true;
  });

  const totalBatches = Math.ceil(filtered.length / BATCH);

  // ── Step 2: import in batches ────────────────────────────────────────────
  async function runImport() {
    setStage("importing");
    setProgress({ step: 0, total: totalBatches, imported: 0, parseRow: 0 });
    let totalImported = 0;
    let totalSkipped  = 0;

    for (let i = 0; i < filtered.length; i += BATCH) {
      const batch   = filtered.slice(i, i + BATCH);
      const stepNum = Math.floor(i / BATCH) + 1;
      setProgress({ step: stepNum, total: totalBatches, imported: totalImported, parseRow: 0 });

      const res  = await fetch("/api/leads/import-bdc", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rows: batch }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? "Import failed on batch " + stepNum);
        setErrorDetail(null);
        setStage("error");
        return;
      }

      totalImported += data.imported ?? 0;
      totalSkipped  += (batch.length - (data.imported ?? 0));
    }

    setDupSkip(totalSkipped);
    setProgress((p) => ({ ...p, imported: totalImported }));
    setStage("done");
  }

  function reset() {
    setFile(null);
    setParsed(null);
    setStage("idle");
    setErrorMsg(null);
    setErrorDetail(null);
    setParsedCount(0);
    setLinesRead(0);
    setProgress({ step: 0, total: 0, imported: 0, parseRow: 0 });
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">BDC Fiber Import</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload the FCC Broadband Data Collection fixed-availability CSV for your state.
          Fiber locations (technology = 50) will be imported as leads with lat/lng pre-filled.
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

      {/* File picker */}
      {stage === "idle" && parsed === null && (
        <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-10 cursor-pointer hover:bg-gray-100 transition-colors">
          <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">Tap to select BDC CSV file</p>
            <p className="text-xs text-gray-400 mt-1">Large files supported — parsed locally on device</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.zip,.CSV"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </label>
      )}

      {/* Parsing spinner */}
      {stage === "parsing" && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-8 flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-blue-800">
              {file?.name ?? "Reading file…"}
            </p>
            {fileSize > 0 && (
              <p className="text-xs text-blue-600">{fmt(fileSize)} file</p>
            )}
            {linesRead > 0 && (
              <p className="text-xs text-blue-600">
                {linesRead.toLocaleString()} lines scanned · {parsedCount.toLocaleString()} locations found
              </p>
            )}
            {linesRead === 0 && (
              <p className="text-xs text-blue-500">Loading file into memory… this may take 10–30 seconds for large files.</p>
            )}
          </div>
          <p className="text-xs text-blue-400">Do not close this page.</p>
        </div>
      )}

      {/* Preview + filters */}
      {stage === "idle" && parsed !== null && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800">
              {file?.name} — {parsed.length.toLocaleString()} total locations parsed
            </p>

            {/* Tech filter */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-600">Technology filter</p>
              <div className="flex gap-2">
                {(["50", "all"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setTechFilter(v)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      techFilter === v ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {v === "50" ? "Fiber only (tech 50)" : "All technologies"}
                  </button>
                ))}
              </div>
            </div>

            {/* Count after filter */}
            <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3">
              <p className="text-sm font-bold text-green-800">
                {filtered.length.toLocaleString()} locations to import
              </p>
              <p className="text-xs text-green-600 mt-0.5">
                {Math.ceil(filtered.length / BATCH)} batch{Math.ceil(filtered.length / BATCH) !== 1 ? "es" : ""} of {BATCH.toLocaleString()} — will run sequentially
              </p>
            </div>

            {/* Sample preview */}
            {filtered.slice(0, 3).map((r, i) => (
              <div key={i} className="text-xs text-gray-500 border-t border-gray-100 pt-2">
                {r.address} · {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
                {r.brand_name ? ` · ${r.brand_name}` : ""}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="text-sm text-gray-500 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50"
            >
              Change file
            </button>
            <button
              onClick={runImport}
              disabled={filtered.length === 0}
              className="flex-1 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2.5 rounded-xl"
            >
              Import {filtered.length.toLocaleString()} Locations →
            </button>
          </div>
        </div>
      )}

      {/* Importing progress */}
      {stage === "importing" && (
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-6 space-y-4">
          <p className="text-sm font-semibold text-gray-800">Importing…</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Batch {progress.step} of {progress.total}</span>
              <span>{progress.imported.toLocaleString()} imported so far</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: progress.total > 0 ? `${(progress.step / progress.total) * 100}%` : "0%" }}
              />
            </div>
          </div>
          <p className="text-xs text-gray-400">Keep this page open. Do not close the app.</p>
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
                {progress.imported.toLocaleString()} new locations added to your leads pool.
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

      {/* Error — deliberately large and hard to miss */}
      {stage === "error" && (
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 px-5 py-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-red-800">Could not read file</p>
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
