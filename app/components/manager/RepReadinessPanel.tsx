"use client";

import { useEffect, useState, useCallback } from "react";

interface ReadinessItem {
  id: string;
  label: string;
  description: string | null;
  category: string;
  order_index: number;
  org_id: string | null;
}

interface RepRow {
  user_id: string;
  full_name: string;
  role: string;
  field_cleared: boolean;
  checks: Record<string, { checked_at: string; notes: string | null }>;
  completed: number;
  total: number;
}

interface ShadowSession {
  id: string;
  rep_id: string;
  session_date: string;
  duration_hrs: number | null;
  mentor_name: string;
  notes: string | null;
  manager_approved: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  appearance:    "Appearance",
  documentation: "Documentation",
  training:      "Training",
  field_setup:   "Field Setup",
  general:       "General",
};
const CATEGORY_ORDER = ["appearance", "documentation", "training", "field_setup", "general"];
const CATEGORIES = [
  { value: "appearance", label: "Appearance" },
  { value: "documentation", label: "Documentation" },
  { value: "training", label: "Training" },
  { value: "field_setup", label: "Field Setup" },
  { value: "general", label: "General" },
];

export default function RepReadinessPanel() {
  const [reps, setReps] = useState<RepRow[]>([]);
  const [items, setItems] = useState<ReadinessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [tab, setTab] = useState<"checklist" | "shadows">("checklist");

  // Add custom item form
  const [addingItem, setAddingItem] = useState(false);
  const [itemForm, setItemForm] = useState({ label: "", description: "", category: "general" });
  const [savingItem, setSavingItem] = useState(false);

  // Shadow session form
  const [addingShadow, setAddingShadow] = useState(false);
  const [shadowForm, setShadowForm] = useState({ mentor_id: "", session_date: "", duration_hrs: "", notes: "" });
  const [savingShadow, setSavingShadow] = useState(false);
  const [shadows, setShadows] = useState<ShadowSession[]>([]);
  const [loadingShadows, setLoadingShadows] = useState(false);
  const [clearingSaving, setClearingSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/manager/readiness");
    const d = await res.json();
    setReps(d.data ?? []);
    setItems(d.items ?? []);
    setLoading(false);
    if (!selected && d.data?.length) setSelected(d.data[0].user_id);
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  const loadShadows = useCallback(async (repId: string) => {
    setLoadingShadows(true);
    const res = await fetch(`/api/manager/shadow-sessions?rep_id=${repId}`);
    const d = await res.json();
    setShadows(d.data ?? []);
    setLoadingShadows(false);
  }, []);

  useEffect(() => {
    if (selected && tab === "shadows") loadShadows(selected);
  }, [selected, tab, loadShadows]);

  async function toggle(userId: string, itemId: string, currentlyChecked: boolean) {
    setSaving(itemId);
    await fetch("/api/manager/readiness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, item_id: itemId, checked: !currentlyChecked }),
    });
    setReps((prev) => prev.map((r) => {
      if (r.user_id !== userId) return r;
      const checks = { ...r.checks };
      if (currentlyChecked) { delete checks[itemId]; }
      else { checks[itemId] = { checked_at: new Date().toISOString(), notes: null }; }
      return { ...r, checks, completed: Object.keys(checks).length };
    }));
    setSaving(null);
  }

  async function saveItem() {
    if (!itemForm.label.trim()) return;
    setSavingItem(true);
    const res = await fetch("/api/manager/readiness/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(itemForm),
    });
    const d = await res.json();
    if (d.data) {
      setItems((prev) => [...prev, d.data]);
      setReps((prev) => prev.map((r) => ({ ...r, total: r.total + 1 })));
    }
    setItemForm({ label: "", description: "", category: "general" });
    setAddingItem(false);
    setSavingItem(false);
  }

  async function removeItem(itemId: string) {
    await fetch("/api/manager/readiness/items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: itemId }),
    });
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setReps((prev) => prev.map((r) => ({
      ...r,
      total: r.total - 1,
      completed: r.checks[itemId] ? r.completed - 1 : r.completed,
    })));
  }

  async function saveShadow() {
    if (!shadowForm.mentor_id || !shadowForm.session_date || !selected) return;
    setSavingShadow(true);
    await fetch("/api/manager/shadow-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rep_id: selected,
        mentor_id: shadowForm.mentor_id,
        session_date: shadowForm.session_date,
        duration_hrs: shadowForm.duration_hrs ? parseFloat(shadowForm.duration_hrs) : null,
        notes: shadowForm.notes || null,
      }),
    });
    setShadowForm({ mentor_id: "", session_date: "", duration_hrs: "", notes: "" });
    setAddingShadow(false);
    setSavingShadow(false);
    loadShadows(selected);
  }

  async function approveShadow(id: string) {
    await fetch(`/api/manager/shadow-sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manager_approved: true }),
    });
    setShadows((prev) => prev.map((s) => s.id === id ? { ...s, manager_approved: true } : s));
  }

  async function clearToWork(repId: string, cleared: boolean) {
    setClearingSaving(true);
    await fetch("/api/manager/clearance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rep_id: repId, cleared }),
    });
    setReps((prev) => prev.map((r) => r.user_id === repId ? { ...r, field_cleared: cleared } : r));
    setClearingSaving(false);
  }

  const activeRep = reps.find((r) => r.user_id === selected);
  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    label: CATEGORY_LABELS[cat] ?? cat,
    items: items.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  // Other reps for mentor picker
  const otherReps = reps.filter((r) => r.user_id !== selected);

  if (loading) return (
    <div className="flex flex-col gap-2 max-w-4xl">
      {[1,2,3].map((i) => <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />)}
    </div>
  );

  if (!reps.length) return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center max-w-4xl">
      <p className="text-sm text-gray-400">No reps on your team yet.</p>
    </div>
  );

  return (
    <div className="flex gap-4 max-w-5xl">
      {/* Rep list sidebar */}
      <div className="w-48 shrink-0 flex flex-col gap-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 mb-1">Team Members</p>
        {reps.map((rep) => {
          const pct = rep.total > 0 ? Math.round((rep.completed / rep.total) * 100) : 0;
          const isSelected = selected === rep.user_id;
          return (
            <button key={rep.user_id} onClick={() => setSelected(rep.user_id)}
              className={`rounded-xl px-3 py-2.5 text-left transition-colors ${isSelected ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50 border border-transparent"}`}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-blue-700">{rep.full_name.charAt(0)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{rep.full_name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="flex-1 h-1 rounded-full bg-gray-200 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${pct === 100 ? "bg-green-500" : "bg-blue-400"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-400">{pct}%</span>
                  </div>
                  {rep.field_cleared && <span className="text-xs text-green-600 font-medium">✓ cleared</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main area */}
      {activeRep && (
        <div className="flex-1 min-w-0">
          {/* Rep header + clear to work */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">{activeRep.full_name}</h2>
              <p className="text-sm text-gray-500">{activeRep.completed} of {activeRep.total} items verified</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {activeRep.field_cleared ? (
                <span className="text-xs bg-green-100 text-green-700 font-medium rounded-full px-3 py-1">Field Cleared ✓</span>
              ) : null}
              <button
                onClick={() => clearToWork(activeRep.user_id, !activeRep.field_cleared)}
                disabled={clearingSaving}
                className={`text-xs font-medium rounded-lg px-3 py-1.5 transition-colors ${
                  activeRep.field_cleared
                    ? "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {clearingSaving ? "Saving…" : activeRep.field_cleared ? "Revoke Clearance" : "Clear to Work"}
              </button>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1 border-b border-gray-100 pb-1 mb-4">
            {([
              { key: "checklist", label: "Field Checklist" },
              { key: "shadows",   label: "Shadow Sessions" },
            ] as const).map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-100"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Checklist */}
          {tab === "checklist" && (
            <div className="flex flex-col gap-5">
              {grouped.map(({ cat, label, items: groupItems }) => (
                <div key={cat}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
                  <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                    {groupItems.map((item, idx) => {
                      const check = activeRep.checks[item.id];
                      const isChecked = !!check;
                      const isSaving = saving === item.id;
                      return (
                        <div key={item.id}
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${idx > 0 ? "border-t border-gray-50" : ""} ${isChecked ? "bg-green-50/30" : ""}`}
                          onClick={() => !isSaving && toggle(activeRep.user_id, item.id, isChecked)}>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSaving ? "border-gray-300 bg-gray-100" : isChecked ? "border-green-500 bg-green-500" : "border-gray-300 bg-white"}`}>
                            {isChecked && !isSaving && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${isChecked ? "text-gray-500 line-through" : "text-gray-800"}`}>{item.label}</p>
                            {item.description && <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isChecked && <p className="text-xs text-gray-400">{new Date(check.checked_at).toLocaleDateString()}</p>}
                            {item.org_id && (
                              <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                                className="text-gray-200 hover:text-red-400 text-base leading-none ml-1">×</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Add custom item */}
              {addingItem ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 flex flex-col gap-3">
                  <div className="flex gap-2 flex-wrap">
                    {CATEGORIES.map((c) => (
                      <button key={c.value} onClick={() => setItemForm((f) => ({ ...f, category: c.value }))}
                        className={`rounded-lg px-3 py-1 text-xs font-medium border transition-colors ${itemForm.category === c.value ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-500 bg-white"}`}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                  <input value={itemForm.label} onChange={(e) => setItemForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="Item label (e.g. Tablet case and charger)"
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
                  <input value={itemForm.description} onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Description (optional)"
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
                  <div className="flex gap-2">
                    <button onClick={saveItem} disabled={savingItem}
                      className="bg-blue-600 text-white text-sm font-medium rounded-lg px-4 py-1.5 hover:bg-blue-700 disabled:opacity-50">
                      {savingItem ? "Saving…" : "Add Item"}
                    </button>
                    <button onClick={() => setAddingItem(false)} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingItem(true)}
                  className="rounded-2xl border border-dashed border-gray-200 py-3 text-sm text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors">
                  + Add custom checklist item
                </button>
              )}
            </div>
          )}

          {/* Shadow sessions */}
          {tab === "shadows" && (
            <div className="flex flex-col gap-4">
              {loadingShadows ? (
                <div className="flex flex-col gap-2">{[1,2].map((i) => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)}</div>
              ) : !shadows.length ? (
                <div className="rounded-2xl border border-dashed border-gray-200 py-10 text-center">
                  <p className="text-sm text-gray-400">No shadow sessions logged for {activeRep.full_name}.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {shadows.map((s) => (
                    <div key={s.id} className="rounded-xl border border-gray-100 bg-white px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            Shadowed {s.mentor_name}{s.duration_hrs ? ` · ${s.duration_hrs}h` : ""}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{new Date(s.session_date).toLocaleDateString()}</p>
                          {s.notes && <p className="text-xs text-gray-500 mt-1">{s.notes}</p>}
                        </div>
                        {s.manager_approved ? (
                          <span className="text-xs bg-green-100 text-green-700 font-medium rounded-full px-2 py-0.5">Approved</span>
                        ) : (
                          <button onClick={() => approveShadow(s.id)}
                            className="text-xs bg-blue-50 text-blue-700 font-medium rounded-lg px-3 py-1 hover:bg-blue-100 transition-colors">
                            Approve
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {addingShadow ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 flex flex-col gap-3">
                  <p className="text-sm font-medium text-gray-800">Log Shadow Session</p>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={shadowForm.mentor_id} onChange={(e) => setShadowForm((f) => ({ ...f, mentor_id: e.target.value }))}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none col-span-2">
                      <option value="">Select mentor / senior rep</option>
                      {otherReps.map((r) => <option key={r.user_id} value={r.user_id}>{r.full_name}</option>)}
                    </select>
                    <input type="date" value={shadowForm.session_date} onChange={(e) => setShadowForm((f) => ({ ...f, session_date: e.target.value }))}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none" />
                    <input type="number" value={shadowForm.duration_hrs} onChange={(e) => setShadowForm((f) => ({ ...f, duration_hrs: e.target.value }))}
                      placeholder="Hours (e.g. 4)" className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none" />
                  </div>
                  <textarea value={shadowForm.notes} onChange={(e) => setShadowForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Notes (optional)" rows={2}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none resize-none" />
                  <div className="flex gap-2">
                    <button onClick={saveShadow} disabled={savingShadow}
                      className="bg-blue-600 text-white text-sm font-medium rounded-lg px-4 py-1.5 hover:bg-blue-700 disabled:opacity-50">
                      {savingShadow ? "Saving…" : "Log Session"}
                    </button>
                    <button onClick={() => setAddingShadow(false)} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingShadow(true)}
                  className="rounded-2xl border border-dashed border-gray-200 py-3 text-sm text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors">
                  + Log shadow session
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
