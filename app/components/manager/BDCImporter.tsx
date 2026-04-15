"use client";

import { useRef, useState } from "react";

// ── BDC column name normalizer ─────────────────────────────────────────────
function norm(s: string) { return s.toLowerCase().replace(/[\s_\-\.]/g, ""); }

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
  const fileRef   = useRef<HTMLInputElement>(null);
  const [stage,   setStage]   = useState<Stage>("idle");
  const [file,    setFile]    = useState<File | null>(null);
  const [parsed,  setParsed]  = useState<ParsedRow[] | null>(null);
  const [techFilter, setTechFilter] = useState<"50" | "all">("50");
  const [brcFilter,  setBrcFilter]  = useState<"R" | "all">("all");
  const [progress, setProgress] = useState({ step: 0, total: 0, imported: 0 });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dupSkip,  setDupSkip]  = useState(0);

  // ── Step 1: parse file client-side ──────────────────────────────────────
  async function handleFile(f: File) {
    setFile(f);
    setStage("parsing");
    setErrorMsg(null);

    // Detect ZIP — BDC downloads come as ZIP, must extract first
    if (f.name.toLowerCase().endsWith(".zip") || f.type === "application/zip" || f.type === "application/x-zip-compressed") {
      setErrorMsg("The BDC file downloaded as a ZIP. Unzip it first, then upload the .csv file inside.");
      setStage("error");
      return;
    }

    try {
      const text = await f.text();
      const lines = text.split(/\r?\n/);
      if (lines.length < 2) throw new Error("File appears empty");

      const headers = parseCSVLine(lines[0]);
      const headerNorms = headers.map(norm);

      // Must have lat/lng at minimum
      const hasLatLng = headerNorms.some((h) => h === "latitude" || h === "lat");
      if (!hasLatLng) {
        throw new Error(
          `Unexpected file format. Columns found: ${headers.slice(0, 8).join(", ")}…\n` +
          "Expected a BDC availability CSV with 'latitude' and 'longitude' columns."
        );
      }

      const rows: ParsedRow[] = [];
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
        // Some BDC files have address text; others only have coordinates
        const streetNum  = get(row, "address_primary", "h_address", "street_address", "address");
        const city       = get(row, "city");
        const stateAbbr  = get(row, "state_abbr", "state");
        const zip        = get(row, "zip_code", "zip", "zipcode", "postal_code");
        const addrParts  = [streetNum, city, stateAbbr + (zip ? " " + zip : "")].filter(Boolean);
        // Fall back to coordinates if no address text in file
        const addr = addrParts.length > 0 ? addrParts.join(", ") : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

        rows.push({
          address:    addr,
          lat,
          lng,
          brand_name: get(row, "brand_name", "brandname", "provider", "provider_name"),
          technology: get(row, "technology"),
          max_down:   parseFloat(get(row, "max_advertised_download_speed", "max_download_speed", "maxdown")) || null,
          max_up:     parseFloat(get(row, "max_advertised_upload_speed",   "max_upload_speed",   "maxup"))   || null,
        });
      }

      if (rows.length === 0) {
        throw new Error(
          "No valid rows found. The file parsed but had no usable lat/lng data.\n" +
          `Columns detected: ${headers.slice(0, 10).join(", ")}`
        );
      }

      setParsed(rows);
      setStage("idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Parse failed");
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
    setProgress({ step: 0, total: totalBatches, imported: 0 });
    let totalImported = 0;
    let totalSkipped  = 0;

    for (let i = 0; i < filtered.length; i += BATCH) {
      const batch = filtered.slice(i, i + BATCH);
      const stepNum = Math.floor(i / BATCH) + 1;
      setProgress({ step: stepNum, total: totalBatches, imported: totalImported });

      const res  = await fetch("/api/leads/import-bdc", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rows: batch }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? "Import failed on batch " + stepNum);
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
    setProgress({ step: 0, total: 0, imported: 0 });
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
        <div className="flex flex-col items-center gap-3 py-10">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-600">Reading file… large files may take a moment.</p>
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

      {/* Error */}
      {stage === "error" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 space-y-3">
          <p className="text-sm font-semibold text-red-800">Import failed</p>
          <p className="text-xs text-red-700">{errorMsg}</p>
          <button
            onClick={reset}
            className="text-sm text-red-700 underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
