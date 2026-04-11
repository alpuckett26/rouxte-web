"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

type Platform = "spotio" | "leadbeam" | "generic";
type LeadStatus = "new" | "attempted" | "contacted" | "qualified" | "appointment_set" | "sold" | "installed" | "closed_lost";
type Step = "upload" | "columns" | "statuses" | "reps" | "preview" | "import";

interface OrgMember { user_id: string; full_name: string; role: string }

interface ColumnMap {
  address: string;
  city: string;
  state: string;
  zip: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  status: string;
  assigned_to: string;
  lat: string;
  lng: string;
  notes: string;
  follow_up_at: string;
  appointment_at: string;
  do_not_knock: string;
  created_at: string;
}

const ROUXTE_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "new",             label: "New" },
  { value: "attempted",       label: "Attempted" },
  { value: "contacted",       label: "Contacted" },
  { value: "qualified",       label: "Qualified" },
  { value: "appointment_set", label: "Appointment Set" },
  { value: "sold",            label: "Sold" },
  { value: "installed",       label: "Installed" },
  { value: "closed_lost",     label: "Closed / Lost" },
];

// Platform default column mappings
const PLATFORM_DEFAULTS: Record<Platform, Partial<ColumnMap>> = {
  spotio: {
    first_name:   "First Name",
    last_name:    "Last Name",
    phone:        "Phone",
    address:      "Address",
    city:         "City",
    state:        "State",
    zip:          "Zip",
    status:       "Status",
    assigned_to:  "Assigned To",
    lat:          "Latitude",
    lng:          "Longitude",
    notes:        "Notes",
    created_at:   "Created Date",
  },
  leadbeam: {
    full_name:    "Name",
    phone:        "Phone",
    address:      "Address",
    status:       "Status",
    assigned_to:  "Rep",
    lat:          "Lat",
    lng:          "Long",
    notes:        "Notes",
    created_at:   "Created",
  },
  generic: {},
};

// Platform default status mappings
const STATUS_DEFAULTS: Record<Platform, Record<string, LeadStatus>> = {
  spotio: {
    "Not Home":         "attempted",
    "No Answer":        "attempted",
    "Not Interested":   "contacted",
    "Do Not Knock":     "closed_lost",
    "Pitched":          "contacted",
    "Callback":         "contacted",
    "Follow Up":        "contacted",
    "Appointment Set":  "appointment_set",
    "Sold":             "sold",
    "Customer":         "sold",
    "Installed":        "installed",
    "New":              "new",
  },
  leadbeam: {
    "New":              "new",
    "Contacted":        "contacted",
    "Not Home":         "attempted",
    "Not Interested":   "closed_lost",
    "Appointment":      "appointment_set",
    "Sold":             "sold",
  },
  generic: {},
};

// ── CSV parser ──────────────────────────────────────────────────────────────────
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };

  function splitLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = splitLine(lines[0]).map((h) => h.replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((l) => splitLine(l));
  return { headers, rows };
}

function detectPlatform(headers: string[]): Platform {
  const h = headers.map((x) => x.toLowerCase());
  if (h.includes("assigned to") || h.includes("first name")) return "spotio";
  if (h.includes("rep") && !h.includes("assigned to")) return "leadbeam";
  return "generic";
}

function getCell(row: string[], headers: string[], col: string): string {
  if (!col) return "";
  const idx = headers.indexOf(col);
  return idx >= 0 ? (row[idx] ?? "") : "";
}

// ── Step indicator ─────────────────────────────────────────────────────────────
const STEPS: { key: Step; label: string }[] = [
  { key: "upload",   label: "Upload" },
  { key: "columns",  label: "Columns" },
  { key: "statuses", label: "Statuses" },
  { key: "reps",     label: "Reps" },
  { key: "preview",  label: "Preview" },
  { key: "import",   label: "Import" },
];

function StepBar({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const done   = i < idx;
        const active = i === idx;
        return (
          <div key={s.key} className="flex items-center">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              active ? "bg-blue-600 text-white" :
              done   ? "text-emerald-400" :
                       "text-gray-600"
            }`}>
              {done ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? "bg-white/20" : "bg-white/5"}`}>{i + 1}</span>
              )}
              {s.label}
            </div>
            {i < STEPS.length - 1 && <div className={`w-6 h-px ${i < idx ? "bg-emerald-500/40" : "bg-white/10"}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Select helper ───────────────────────────────────────────────────────────────
function ColSelect({ value, onChange, headers, required }: {
  value: string; onChange: (v: string) => void; headers: string[]; required?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200 px-3 py-2 focus:outline-none focus:border-blue-500"
    >
      {!required && <option value="">— skip —</option>}
      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
    </select>
  );
}

// ── Main wizard ─────────────────────────────────────────────────────────────────
export default function MigratePage() {
  const [step, setStep]         = useState<Step>("upload");
  const [platform, setPlatform] = useState<Platform>("spotio");
  const [headers, setHeaders]   = useState<string[]>([]);
  const [csvRows, setCsvRows]   = useState<string[][]>([]);
  const [colMap, setColMap]     = useState<Partial<ColumnMap>>({});
  const [statusMap, setStatusMap] = useState<Record<string, LeadStatus>>({});
  const [repMap, setRepMap]     = useState<Record<string, string>>({}); // name → user_id
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number; geocoded: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/manager/org-members")
      .then((r) => r.json())
      .then((d) => setOrgMembers(d.data ?? []));
  }, []);

  // ── Step 1: Upload ───────────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows: r } = parseCsv(text);
      const detected = detectPlatform(h);
      setHeaders(h);
      setCsvRows(r);
      setPlatform(detected);
      setColMap(PLATFORM_DEFAULTS[detected]);
      setStatusMap(STATUS_DEFAULTS[detected]);
      setStep("columns");
    };
    reader.readAsText(file);
  }, []);

  // ── Build preview rows ────────────────────────────────────────────────────────
  function buildRow(raw: string[]) {
    const g = (col: string) => getCell(raw, headers, col ?? "");
    const addrParts = [g(colMap.address ?? ""), g(colMap.city ?? ""), g(colMap.state ?? ""), g(colMap.zip ?? "")].filter(Boolean);
    const address   = addrParts.length > 1 ? addrParts.join(", ") : (addrParts[0] ?? "");
    const nameParts = colMap.full_name
      ? g(colMap.full_name)
      : [g(colMap.first_name ?? ""), g(colMap.last_name ?? "")].filter(Boolean).join(" ");

    const rawStatus = g(colMap.status ?? "");
    const status    = (statusMap[rawStatus] ?? "new") as LeadStatus;
    const repName   = g(colMap.assigned_to ?? "");
    const assignedUserId = repMap[repName] ?? null;
    const lat = parseFloat(g(colMap.lat ?? "")) || null;
    const lng = parseFloat(g(colMap.lng ?? "")) || null;

    return {
      address,
      customer_name:        nameParts || null,
      phone:                g(colMap.phone ?? "") || null,
      status,
      assigned_to_user_id:  assignedUserId,
      lat,
      lng,
      notes:                g(colMap.notes ?? "") || null,
      follow_up_at:         g(colMap.follow_up_at ?? "") || null,
      appointment_at:       g(colMap.appointment_at ?? "") || null,
      is_do_not_knock:      rawStatus?.toLowerCase().includes("do not knock"),
      original_created_at:  g(colMap.created_at ?? "") || null,
      _repName:             repName,
    };
  }

  // ── Unique statuses / reps in the data ───────────────────────────────────────
  const uniqueStatuses = Array.from(new Set(
    csvRows.map((r) => getCell(r, headers, colMap.status ?? "")).filter(Boolean)
  )).sort();

  const uniqueReps = Array.from(new Set(
    csvRows.map((r) => getCell(r, headers, colMap.assigned_to ?? "")).filter(Boolean)
  )).sort();

  // ── Submit import ──────────────────────────────────────────────────────────
  async function runImport() {
    setImporting(true);
    setImportError("");
    const rows = csvRows.map(buildRow).map(({ _repName: _, ...r }) => r);
    try {
      const res = await fetch("/api/leads/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, source_platform: platform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setImportResult(data);
      setStep("import");
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  // ── Field rows for column mapper ──────────────────────────────────────────────
  const FIELD_ROWS: { label: string; key: keyof ColumnMap; required?: boolean; hint?: string }[] = [
    { label: "Street Address *", key: "address",     required: true },
    { label: "City",             key: "city",        hint: "Spotio: separate column" },
    { label: "State",            key: "state" },
    { label: "ZIP",              key: "zip" },
    { label: "First Name",       key: "first_name",  hint: "Or use Full Name below" },
    { label: "Last Name",        key: "last_name" },
    { label: "Full Name",        key: "full_name",   hint: "LeadBeam: single field" },
    { label: "Phone",            key: "phone" },
    { label: "Status",           key: "status" },
    { label: "Assigned To",      key: "assigned_to" },
    { label: "Latitude",         key: "lat" },
    { label: "Longitude",        key: "lng" },
    { label: "Notes",            key: "notes" },
    { label: "Follow-up Date",   key: "follow_up_at" },
    { label: "Appointment Date", key: "appointment_at" },
    { label: "Created Date",     key: "created_at" },
  ];

  // ──────────────────────────────────────────────────────────────────────────────
  return (
    <main className="p-4 md:p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Migrate from Spotio / LeadBeam
        </h1>
        <p className="text-sm text-gray-400 mt-1">Import your team&apos;s leads, statuses, and rep assignments. Your history comes with you.</p>
      </div>

      <StepBar current={step} />

      {/* ── Step 1: Upload ────────────────────────────────────────────────────── */}
      {step === "upload" && (
        <div className="flex flex-col gap-5">
          {/* Platform picker */}
          <div className="flex gap-2">
            {(["spotio", "leadbeam", "generic"] as Platform[]).map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-all capitalize ${
                  platform === p
                    ? "border-blue-500 bg-blue-600/20 text-blue-300"
                    : "border-white/10 bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                {p === "generic" ? "Generic CSV" : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          {/* Drop zone */}
          <div
            className="rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] hover:border-blue-500/40 hover:bg-blue-500/5 transition-all p-12 text-center cursor-pointer"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
          >
            <svg className="w-10 h-10 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-sm font-medium text-gray-300 mb-1">Drop your CSV export here</p>
            <p className="text-xs text-gray-600">or click to browse — CSV files only</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
            <p className="text-xs font-semibold text-gray-400 mb-1.5">How to export from each platform:</p>
            <div className="text-xs text-gray-500 space-y-0.5">
              <p><span className="text-gray-300 font-medium">Spotio:</span> Settings → Data Export → All Pins → CSV</p>
              <p><span className="text-gray-300 font-medium">LeadBeam:</span> Menu → Export → Download CSV</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Column mapping ────────────────────────────────────────────── */}
      {step === "columns" && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">
                {csvRows.length.toLocaleString()} rows detected &middot;{" "}
                <span className="text-blue-400 capitalize">{platform} format</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Map each Rouxte field to the right CSV column.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">Rouxte Field</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">Your CSV Column</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {FIELD_ROWS.map((f) => (
                  <tr key={f.key}>
                    <td className="px-4 py-2.5">
                      <p className="text-sm text-gray-300">{f.label}</p>
                      {f.hint && <p className="text-xs text-gray-600">{f.hint}</p>}
                    </td>
                    <td className="px-4 py-2.5 w-1/2">
                      <ColSelect
                        value={colMap[f.key] ?? ""}
                        onChange={(v) => setColMap((prev) => ({ ...prev, [f.key]: v }))}
                        headers={headers}
                        required={f.required}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep("upload")} className="rounded-xl border border-white/10 text-gray-400 px-4 py-2.5 text-sm font-semibold hover:bg-white/5 transition-colors">← Back</button>
            <button
              onClick={() => setStep("statuses")}
              disabled={!colMap.address}
              className="flex-1 rounded-xl bg-blue-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-blue-500 transition-colors disabled:opacity-30"
            >
              Map Statuses →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Status mapping ────────────────────────────────────────────── */}
      {step === "statuses" && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-sm font-semibold text-white">{uniqueStatuses.length} status values found in your data</p>
            <p className="text-xs text-gray-500 mt-0.5">Map each to a Rouxte status. Defaults are pre-filled based on the detected platform.</p>
          </div>

          {uniqueStatuses.length === 0 && (
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-6 text-center text-sm text-gray-500">
              No status column mapped — all leads will be imported as &quot;New&quot;.
            </div>
          )}

          {uniqueStatuses.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">Their Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">Rouxte Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {uniqueStatuses.map((s) => (
                    <tr key={s}>
                      <td className="px-4 py-2.5 text-gray-300 font-medium">{s}</td>
                      <td className="px-4 py-2.5 w-1/2">
                        <select
                          value={statusMap[s] ?? "new"}
                          onChange={(e) => setStatusMap((prev) => ({ ...prev, [s]: e.target.value as LeadStatus }))}
                          className="w-full rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200 px-3 py-2 focus:outline-none focus:border-blue-500"
                        >
                          {ROUXTE_STATUSES.map((rs) => (
                            <option key={rs.value} value={rs.value}>{rs.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep("columns")} className="rounded-xl border border-white/10 text-gray-400 px-4 py-2.5 text-sm font-semibold hover:bg-white/5 transition-colors">← Back</button>
            <button onClick={() => setStep("reps")} className="flex-1 rounded-xl bg-blue-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-blue-500 transition-colors">
              Match Reps →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Rep matching ──────────────────────────────────────────────── */}
      {step === "reps" && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-sm font-semibold text-white">{uniqueReps.length} rep names found in your data</p>
            <p className="text-xs text-gray-500 mt-0.5">Match each name to a Rouxte team member. Unmatched leads will be unassigned.</p>
          </div>

          {uniqueReps.length === 0 && (
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-6 text-center text-sm text-gray-500">
              No rep column mapped — all leads will be unassigned.
            </div>
          )}

          {uniqueReps.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">Their Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">Rouxte Member</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {uniqueReps.map((name) => {
                    // Try auto-match by name similarity
                    const autoMatch = orgMembers.find(
                      (m) => m.full_name.toLowerCase() === name.toLowerCase() ||
                             m.full_name.toLowerCase().includes(name.toLowerCase().split(" ")[0])
                    );
                    return (
                      <tr key={name}>
                        <td className="px-4 py-2.5 text-gray-300 font-medium">{name}</td>
                        <td className="px-4 py-2.5 w-1/2">
                          <select
                            value={repMap[name] ?? autoMatch?.user_id ?? ""}
                            onChange={(e) => setRepMap((prev) => ({ ...prev, [name]: e.target.value }))}
                            className="w-full rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200 px-3 py-2 focus:outline-none focus:border-blue-500"
                          >
                            <option value="">— unassigned —</option>
                            {orgMembers.map((m) => (
                              <option key={m.user_id} value={m.user_id}>{m.full_name} ({m.role})</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep("statuses")} className="rounded-xl border border-white/10 text-gray-400 px-4 py-2.5 text-sm font-semibold hover:bg-white/5 transition-colors">← Back</button>
            <button onClick={() => setStep("preview")} className="flex-1 rounded-xl bg-blue-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-blue-500 transition-colors">
              Preview →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 5: Preview ───────────────────────────────────────────────────── */}
      {step === "preview" && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-sm font-semibold text-white">Importing <span className="text-blue-400">{csvRows.length.toLocaleString()} leads</span> from {platform}</p>
            <p className="text-xs text-gray-500 mt-0.5">Here&apos;s how the first 5 rows will look after mapping.</p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {["Address", "Name", "Phone", "Status", "Rep", "Has Coords"].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 text-gray-400 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {csvRows.slice(0, 5).map((raw, i) => {
                  const row = buildRow(raw);
                  const repName = uniqueReps.find((n) => {
                    const mapped = repMap[n] ?? orgMembers.find((m) => m.full_name.toLowerCase() === n.toLowerCase())?.user_id;
                    return mapped === row.assigned_to_user_id;
                  });
                  const repDisplay = row.assigned_to_user_id
                    ? (orgMembers.find((m) => m.user_id === row.assigned_to_user_id)?.full_name ?? repName ?? "")
                    : "Unassigned";
                  return (
                    <tr key={i}>
                      <td className="px-3 py-2.5 text-gray-300 max-w-[180px] truncate">{row.address || <span className="text-red-400">Missing!</span>}</td>
                      <td className="px-3 py-2.5 text-gray-400">{row.customer_name ?? "—"}</td>
                      <td className="px-3 py-2.5 text-gray-400">{row.phone ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-gray-300">{row.status}</span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-400">{repDisplay}</td>
                      <td className="px-3 py-2.5">
                        {row.lat && row.lng
                          ? <span className="text-emerald-400">✓</span>
                          : <span className="text-amber-400">geocode</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {importError && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{importError}</div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep("reps")} className="rounded-xl border border-white/10 text-gray-400 px-4 py-2.5 text-sm font-semibold hover:bg-white/5 transition-colors">← Back</button>
            <button
              onClick={runImport}
              disabled={importing}
              className="flex-1 rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {importing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Importing {csvRows.length.toLocaleString()} leads…
                </>
              ) : (
                `Import ${csvRows.length.toLocaleString()} Leads`
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 6: Done ──────────────────────────────────────────────────────── */}
      {step === "import" && importResult && (
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-2xl font-black text-emerald-300 mb-1">{importResult.imported.toLocaleString()} leads imported</p>
            <p className="text-sm text-emerald-500">Migration from {platform} complete</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-white">{importResult.imported.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-0.5">Imported</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-amber-400">{importResult.geocoded.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-0.5">Geocoded</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-red-400">{importResult.failed.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-0.5">Failed</p>
            </div>
          </div>

          <a
            href="/map"
            className="block text-center rounded-xl bg-blue-600 text-white px-4 py-3 text-sm font-semibold hover:bg-blue-500 transition-colors"
          >
            View leads on map →
          </a>
        </div>
      )}
    </main>
  );
}
