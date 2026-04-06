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

  // Shared state
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setZipFetched(false);
    try {
      const res = await fetch(`/api/zip-addresses?zip=${zip}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Lookup failed"); return; }
      if (!json.data?.length) { setError(`No addresses found in zip code ${zip}.`); return; }
      setZipRows(json.data);
      setZipFetched(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setZipLoading(false);
    }
  }

  async function handleImport() {
    const activeRows = tab === "file" ? rows : zipRows;
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

  const previewRows = tab === "file" ? rows : zipRows;
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
              onClick={() => { setTab(t); setError(null); }}
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
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  Pull all residential addresses from OpenStreetMap for a zip code. Addresses include coordinates for map display.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={zip}
                    onChange={(e) => { setZip(e.target.value.replace(/\D/g, "").slice(0, 5)); setZipFetched(false); setZipRows([]); }}
                    placeholder="e.g. 90210"
                    maxLength={5}
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <Button onClick={fetchZip} disabled={zipLoading || zip.length !== 5} variant="secondary">
                    {zipLoading ? "Searching…" : "Search"}
                  </Button>
                </div>
              </div>
              {zipFetched && zipRows.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">{zipRows.length} addresses found in {zip}</p>
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
                      <td className="px-3 py-2 text-gray-900 max-w-[200px] truncate">{row.address}</td>
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
