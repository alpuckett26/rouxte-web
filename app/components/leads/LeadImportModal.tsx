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
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function reset() {
    setRows([]);
    setFileName("");
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

  async function handleImport() {
    if (!rows.length) return;
    setImporting(true);
    setError(null);
    try {
      const notesMap: Record<number, string> = {};
      rows.forEach((r, i) => { if (r.notes) notesMap[i] = r.notes; });

      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, notes_map: notesMap }),
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Import Leads</h2>
          <button onClick={() => { reset(); onClose(); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {/* Drop zone */}
          {!rows.length && (
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
          )}

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

          {/* Preview */}
          {rows.length > 0 && !result && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{fileName}</p>
                  <p className="text-xs text-gray-500">{rows.length} leads ready to import</p>
                </div>
                <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 underline">
                  Change file
                </button>
              </div>

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
                    {rows.slice(0, 8).map((row, i) => (
                      <tr key={i} className="bg-white">
                        <td className="px-3 py-2 text-gray-900 max-w-[200px] truncate">{row.address}</td>
                        <td className="px-3 py-2 text-gray-600">{row.customer_name ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{row.phone ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-400">
                          {row.lat && row.lng ? `${row.lat.toFixed(4)}, ${row.lng.toFixed(4)}` : "No coords"}
                        </td>
                      </tr>
                    ))}
                    {rows.length > 8 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-center text-gray-400">
                          +{rows.length - 8} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <button onClick={() => { reset(); onClose(); }} className="text-sm text-gray-500 hover:text-gray-700">
            {result ? "Close" : "Cancel"}
          </button>
          {rows.length > 0 && !result && (
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Importing…" : `Import ${rows.length} Lead${rows.length !== 1 ? "s" : ""}`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
