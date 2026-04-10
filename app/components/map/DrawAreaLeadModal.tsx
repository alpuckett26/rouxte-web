"use client";

import { useEffect, useState } from "react";

interface BboxAddress {
  address: string;
  lat: number | null;
  lng: number | null;
}

interface Props {
  bbox: { south: number; north: number; west: number; east: number };
  reps: { user_id: string; full_name: string; role: string }[];
  teams: { id: string; name: string; member_count: number }[];
  onClose: () => void;
  onDone: (importedCount: number) => void;
}

type Phase = "loading" | "confirm" | "importing" | "done" | "error";
type AssignMode = "pool" | "team" | "rep";

export default function DrawAreaLeadModal({ bbox, reps, teams, onClose, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [addresses, setAddresses] = useState<BboxAddress[]>([]);
  const [capped, setCapped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [assignMode, setAssignMode] = useState<AssignMode>("pool");
  const [selectedTeam, setSelectedTeam] = useState(teams[0]?.id ?? "");
  const [selectedRep, setSelectedRep] = useState(reps[0]?.user_id ?? "");

  const [importedCount, setImportedCount] = useState(0);

  // Fetch addresses on mount
  useEffect(() => {
    const params = new URLSearchParams({
      south: String(bbox.south),
      north: String(bbox.north),
      west:  String(bbox.west),
      east:  String(bbox.east),
    });
    fetch(`/api/leads/bbox-addresses?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? "Failed to load addresses."); setPhase("error"); return; }
        if (!json.data?.length) { setError("No OSM address data found in this area. Try a smaller box or use the ZIP import."); setPhase("error"); return; }
        setAddresses(json.data);
        setCapped(json.capped ?? false);
        setPhase("confirm");
      })
      .catch(() => { setError("Network error. Please try again."); setPhase("error"); });
  }, [bbox]);

  async function handleConfirm() {
    setPhase("importing");
    try {
      // Step 1: Create leads
      const importRes = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: addresses }),
      });
      const importJson = await importRes.json();
      if (!importRes.ok) { setError(importJson.error ?? "Import failed."); setPhase("error"); return; }

      const count: number = importJson.imported ?? 0;
      setImportedCount(count);

      // Step 2: Assign if needed (skip for pool mode)
      if (assignMode !== "pool" && importJson.lead_ids?.length) {
        const assignBody =
          assignMode === "team"
            ? { lead_ids: importJson.lead_ids, team_id: selectedTeam }
            : { lead_ids: importJson.lead_ids, assign_to: selectedRep };

        await fetch("/api/leads/bulk-assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(assignBody),
        });
      }

      setPhase("done");
      onDone(count);
    } catch {
      setError("Network error during import."); setPhase("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Create Leads from Area</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {phase === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8 text-gray-500">
              <svg className="animate-spin w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <p className="text-sm">Searching for addresses in this area…</p>
            </div>
          )}

          {phase === "error" && (
            <div className="py-6 text-center text-sm text-gray-500">
              <p className="text-red-500 font-medium mb-1">No addresses found</p>
              <p>{error}</p>
            </div>
          )}

          {phase === "importing" && (
            <div className="flex flex-col items-center gap-3 py-8 text-gray-500">
              <svg className="animate-spin w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <p className="text-sm">Creating leads…</p>
            </div>
          )}

          {phase === "done" && (
            <div className="py-6 text-center">
              <p className="text-green-600 font-semibold text-lg">{importedCount} lead{importedCount !== 1 ? "s" : ""} created!</p>
              <p className="text-sm text-gray-500 mt-1">
                {assignMode === "pool" ? "Saved to unassigned pool." :
                 assignMode === "team" ? `Assigned to team.` :
                 `Assigned to rep.`}
              </p>
            </div>
          )}

          {phase === "confirm" && (
            <div className="flex flex-col gap-4">
              {/* Count */}
              <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                <p className="text-sm font-semibold text-blue-800">
                  {addresses.length} address{addresses.length !== 1 ? "es" : ""} found in selected area
                  {capped && <span className="font-normal text-blue-600"> (limit reached — draw a smaller box for more)</span>}
                </p>
              </div>

              {/* Address preview */}
              <div className="rounded-xl border border-gray-100 divide-y divide-gray-50 max-h-36 overflow-y-auto text-xs text-gray-600">
                {addresses.slice(0, 6).map((a, i) => (
                  <p key={i} className="px-3 py-1.5 truncate">{a.address}</p>
                ))}
                {addresses.length > 6 && (
                  <p className="px-3 py-1.5 text-gray-400">+{addresses.length - 6} more…</p>
                )}
              </div>

              {/* Assignment options */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assign to</p>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="assign" checked={assignMode === "pool"} onChange={() => setAssignMode("pool")} className="accent-blue-500" />
                  <span className="text-sm text-gray-700">Unassigned pool</span>
                </label>

                {teams.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="assign" checked={assignMode === "team"} onChange={() => setAssignMode("team")} className="accent-blue-500" />
                    <span className="text-sm text-gray-700">Team</span>
                    {assignMode === "team" && (
                      <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}
                        className="ml-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-100">
                        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    )}
                  </label>
                )}

                {reps.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="assign" checked={assignMode === "rep"} onChange={() => setAssignMode("rep")} className="accent-blue-500" />
                    <span className="text-sm text-gray-700">Rep</span>
                    {assignMode === "rep" && (
                      <select value={selectedRep} onChange={(e) => setSelectedRep(e.target.value)}
                        className="ml-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-100">
                        {reps.map((r) => <option key={r.user_id} value={r.user_id}>{r.full_name}</option>)}
                      </select>
                    )}
                  </label>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 text-sm text-gray-500 hover:text-gray-700 py-2">
            {phase === "done" ? "Close" : "Cancel"}
          </button>
          {phase === "confirm" && (
            <button onClick={handleConfirm}
              className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl py-2.5 hover:bg-blue-700 active:scale-95 transition-all">
              Create {addresses.length} Lead{addresses.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
