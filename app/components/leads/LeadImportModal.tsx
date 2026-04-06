"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import Button from "@/components/ui/Button";

interface ParsedRow {
  address: string;
  customer_name?: string;
  phone?: string;
  notes?: string;
  lat?: number | null;
  lng?: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: (count: number) => void;
}

type Tab = "file" | "zip";

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, "");
}

function parseSheet(worksheet: XLSX.WorkSheet): ParsedRow[] {
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });
  const rows: ParsedRow[] = [];

  for (const r of raw) {
    const get = (...names: string[]) => {
      for (const name of names) {
        for (const [k, v] of Object.entries(r)) {
          if (normalizeKey(k) === normalizeKey(name)) return String(v ?? "").trim();
        }
      }
      return "";
    };

    const address = get("address", "street", "streetaddress", "addr");
    if (!address) continue;

    const latStr = get("lat", "latitude");
    const lngStr = get("lng", "lon", "longitude");

    rows.push({
      address,
      customer_name: get("customername", "customer", "name", "fullname") || undefined,
      phone: get("phone", "phonenumber", "mobile", "cell") || undefined,
      notes: get("notes", "note", "comment", "comments") || undefined,
      lat: latStr ? parseFloat(latStr) || null : null,
      lng: lngStr ? parseFloat(lngStr) || null : null,
    });
  }
  return rows;
}

export default function LeadImportModal({ open, onClose, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("file");

  // File tab state
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);

  // Zip tab state
  const [zip, setZip] = useState("");
  const [zipRows, setZipRows] = useState<ParsedRow[]>([]);
  const [zipLoading, setZipLoading] = useState(false);
  const [zipFetched, setZipFetched] = useState(false);
  const [streetFilter, setStreetFilter] = useState("");
  const [numFrom, setNumFrom] = useState("");
  const [numTo, setNumTo] = useState("");
  const [clientStreetFilter, setClientStreetFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState<"all" | "available" | "unavailable">("all");
  const [coverageMap, setCoverageMap] = useState<Record<string, boolean>>({}); // address -> covered
  const [checkingCoverage, setCheckingCoverage] = useState(false);

  // Shared state
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  function reset() {
    setRows([]);
    setFileName("");
    setZipRows([]);
    setZipFetched(false);
    setResult(null);
    setError(null);
  }

  function handleFile(file: File) {
    setError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const parsed = parseSheet(ws);
        if (!parsed.length) {
          setError("No valid rows found. Make sure the file has an 'Address' column.");
          return;
        }
        setRows(parsed);
        setFileName(file.name);
      } catch {
        setError("Could not parse file. Use .xlsx, .xls, or .csv format.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function fetchZip() {
    if (!zip || zip.length !== 5) { setError("Enter a valid 5-digit zip code."); return; }
    setZipLoading(true);
    setError(null);
    setWarning(null);
    setZipFetched(false);
    setClientStreetFilter("");
    try {
      const params = new URLSearchParams({ zip });
      if (streetFilter.trim()) params.set("street", streetFilter.trim());
      if (numFrom.trim()) params.set("num_from", numFrom.trim());
      if (numTo.trim()) params.set("num_to", numTo.trim());
      const res = await fetch(`/api/zip-addresses?${params}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Lookup failed. Try the file import for this zip code."); return; }
      if (!json.data?.length) { setError(`No addresses found in zip code ${zip}. OSM may not have data for this area — use file import instead.`); return; }
      const fetched: ParsedRow[] = json.data;
      setZipRows(fetched);
      setZipFetched(true);
      if (json.capped) setWarning(`Showing first 500 addresses — this zip has more. Use file import for complete coverage.`);

      // Batch coverage check if service filter is set
      if (serviceFilter !== "all") {
        setCheckingCoverage(true);
        try {
          const points = fetched
            .filter((r) => r.lat != null && r.lng != null)
            .map((r) => ({ lat: r.lat as number, lng: r.lng as number }));

          const covRes = await fetch("/api/fcc/batch-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ points }),
          });
          const covJson = await covRes.json();
          const results: boolean[] = covJson.results ?? [];

          const map: Record<string, boolean> = {};
          let pi = 0;
          fetched.forEach((r) => {
            if (r.lat != null && r.lng != null) {
              map[r.address] = results[pi++] ?? false;
            } else {
              map[r.address] = false;
            }
          });
          setCoverageMap(map);
        } catch {
          // Coverage check failed — show all
          setCoverageMap({});
        } finally {
          setCheckingCoverage(false);
        }
      } else {
        setCoverageMap({});
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setZipLoading(false);
    }
  }

  async function handleImport() {
    const activeRows = tab === "file" ? rows : filteredZipRows;
    if (!activeRows.length) return;
    setImporting(true);
    setError(null);
    try {
      const notesMap: Record<number, string> = {};
      activeRows.forEach((r, i) => { if (r.notes) notesMap[i] = r.notes; });

      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: activeRows, notes_map: notesMap }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Import failed"); return; }
      setResult(`${json.imported} leads imported successfully.`);
      onImported(json.imported);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setImporting(false);
    }
  }

  const filteredZipRows = zipRows.filter((r) => {
    if (clientStreetFilter.trim() && !r.address.toLowerCase().includes(clientStreetFilter.toLowerCase())) return false;
    if (serviceFilter !== "all" && Object.keys(coverageMap).length > 0) {
      const covered = coverageMap[r.address] ?? false;
      if (serviceFilter === "available" && !covered) return false;
      if (serviceFilter === "unavailable" && covered) return false;
    }
    return true;
  });
  const previewRows = tab === "file" ? rows : filteredZipRows;
  const hasRows = previewRows.length > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Import Leads</h2>
          <button onClick={() => { reset(); onClose(); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          {(["file", "zip"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); setWarning(null); }}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "file" ? "Upload File" : "By Zip Code"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {warning && !error && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
              {warning}
            </div>
          )}
          {result && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              {result}
            </div>
          )}

          {/* File tab */}
          {tab === "file" && !result && (
            <>
              {!rows.length ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                    dragging ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="text-3xl mb-2">📄</div>
                  <p className="text-sm font-medium text-gray-700">Drop your spreadsheet here</p>
                  <p className="text-xs text-gray-400 mt-1">or click to browse — .xlsx, .xls, .csv</p>
                  <p className="text-xs text-gray-400 mt-3">Required column: <strong>Address</strong></p>
                  <p className="text-xs text-gray-400">Optional: Customer Name, Phone, Notes, Lat, Lng</p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{fileName}</p>
                    <p className="text-xs text-gray-500">{rows.length} leads ready</p>
                  </div>
                  <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 underline">Change file</button>
                </div>
              )}
            </>
          )}

          {/* Zip tab */}
          {tab === "zip" && !result && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <p className="text-sm text-gray-600">
                  Pull addresses from OpenStreetMap for a zip code. Use filters to narrow results before searching.
                </p>

                {/* Zip + street filter row */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={zip}
                    onChange={(e) => { setZip(e.target.value.replace(/\D/g, "").slice(0, 5)); setZipFetched(false); setZipRows([]); }}
                    placeholder="Zip code"
                    maxLength={5}
                    className="w-28 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <input
                    type="text"
                    value={streetFilter}
                    onChange={(e) => setStreetFilter(e.target.value)}
                    placeholder="Street name contains… (optional)"
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {/* House number range + service filter row */}
                <div className="flex gap-2 items-center flex-wrap">
                  <span className="text-xs text-gray-500 whitespace-nowrap">House #:</span>
                  <input
                    type="number"
                    value={numFrom}
                    onChange={(e) => setNumFrom(e.target.value)}
                    placeholder="From"
                    className="w-20 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <span className="text-xs text-gray-400">–</span>
                  <input
                    type="number"
                    value={numTo}
                    onChange={(e) => setNumTo(e.target.value)}
                    placeholder="To"
                    className="w-20 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <select
                    value={serviceFilter}
                    onChange={(e) => setServiceFilter(e.target.value as "all" | "available" | "unavailable")}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="all">All addresses</option>
                    <option value="available">Service available</option>
                    <option value="unavailable">Not yet serviceable</option>
                  </select>
                  <Button onClick={fetchZip} disabled={zipLoading || zip.length !== 5} variant="secondary">
                    {zipLoading ? "Searching…" : "Search"}
                  </Button>
                </div>
              </div>

              {zipFetched && zipRows.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-gray-500">
                    {filteredZipRows.length} of {zipRows.length} addresses
                    {checkingCoverage && <span className="ml-1 text-blue-500">· checking coverage…</span>}
                    {!checkingCoverage && serviceFilter !== "all" && Object.keys(coverageMap).length > 0 && (
                      <span className="ml-1 text-gray-400">
                        · {Object.values(coverageMap).filter(Boolean).length} serviceable
                      </span>
                    )}
                  </p>
                  <input
                    type="text"
                    value={clientStreetFilter}
                    onChange={(e) => setClientStreetFilter(e.target.value)}
                    placeholder="Filter results…"
                    className="ml-auto w-40 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              )}
            </div>
          )}

          {/* Preview table — shared */}
          {hasRows && !result && (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="px-3 py-2 text-left font-medium">Address</th>
                    <th className="px-3 py-2 text-left font-medium">Customer</th>
                    <th className="px-3 py-2 text-left font-medium">Phone</th>
                    <th className="px-3 py-2 text-left font-medium">Coords</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {previewRows.slice(0, 8).map((row, i) => (
                    <tr key={i} className="bg-white">
                      <td className="px-3 py-2 text-gray-900 max-w-[200px]">
                        <div className="flex items-center gap-1.5 truncate">
                          {tab === "zip" && Object.keys(coverageMap).length > 0 && (
                            <span className={`w-2 h-2 rounded-full shrink-0 ${coverageMap[row.address] ? "bg-green-500" : "bg-gray-300"}`} title={coverageMap[row.address] ? "Service available" : "Not yet serviceable"} />
                          )}
                          <span className="truncate">{row.address}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{row.customer_name ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-600">{row.phone ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-400">
                        {row.lat && row.lng ? `${(row.lat as number).toFixed(4)}, ${(row.lng as number).toFixed(4)}` : "No coords"}
                      </td>
                    </tr>
                  ))}
                  {previewRows.length > 8 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-center text-gray-400">
                        +{previewRows.length - 8} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <button onClick={() => { reset(); onClose(); }} className="text-sm text-gray-500 hover:text-gray-700">
            {result ? "Close" : "Cancel"}
          </button>
          {hasRows && !result && (
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Importing…" : `Import ${previewRows.length} Lead${previewRows.length !== 1 ? "s" : ""}`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
