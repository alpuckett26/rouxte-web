"use client";

import { useEffect, useState, useCallback } from "react";

interface ReadinessItem {
  id: string;
  label: string;
  description: string | null;
  category: string;
  order_index: number;
}

interface RepRow {
  user_id: string;
  full_name: string;
  role: string;
  checks: Record<string, { checked_at: string; notes: string | null }>;
  completed: number;
  total: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  appearance:    "Appearance",
  documentation: "Documentation",
  training:      "Training",
  field_setup:   "Field Setup",
};

const CATEGORY_ORDER = ["appearance", "documentation", "training", "field_setup"];

export default function RepReadinessPanel() {
  const [reps, setReps] = useState<RepRow[]>([]);
  const [items, setItems] = useState<ReadinessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/manager/readiness");
    const d = await res.json();
    setReps(d.data ?? []);
    setItems(d.items ?? []);
    setLoading(false);
    if (!selected && d.data?.length) setSelected(d.data[0].user_id);
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  async function toggle(userId: string, itemId: string, currentlyChecked: boolean) {
    setSaving(itemId);
    await fetch("/api/manager/readiness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, item_id: itemId, checked: !currentlyChecked }),
    });
    // Optimistic update
    setReps((prev) => prev.map((r) => {
      if (r.user_id !== userId) return r;
      const checks = { ...r.checks };
      if (currentlyChecked) {
        delete checks[itemId];
      } else {
        checks[itemId] = { checked_at: new Date().toISOString(), notes: null };
      }
      return { ...r, checks, completed: Object.keys(checks).length };
    }));
    setSaving(null);
  }

  const activeRep = reps.find((r) => r.user_id === selected);
  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    label: CATEGORY_LABELS[cat] ?? cat,
    items: items.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  if (loading) {
    return (
      <div className="flex flex-col gap-2 max-w-4xl">
        {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />)}
      </div>
    );
  }

  if (!reps.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center max-w-4xl">
        <p className="text-sm text-gray-400">No reps on your team yet.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 max-w-4xl">
      {/* Rep list sidebar */}
      <div className="w-48 shrink-0 flex flex-col gap-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 mb-1">Team Members</p>
        {reps.map((rep) => {
          const pct = rep.total > 0 ? Math.round((rep.completed / rep.total) * 100) : 0;
          const isSelected = selected === rep.user_id;
          return (
            <button
              key={rep.user_id}
              onClick={() => setSelected(rep.user_id)}
              className={`rounded-xl px-3 py-2.5 text-left transition-colors ${
                isSelected ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-blue-700">{rep.full_name.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{rep.full_name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="flex-1 h-1 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct === 100 ? "bg-green-500" : "bg-blue-400"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{pct}%</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Checklist */}
      {activeRep && (
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">{activeRep.full_name}</h2>
              <p className="text-sm text-gray-500">
                {activeRep.completed} of {activeRep.total} items verified
                {activeRep.completed === activeRep.total && activeRep.total > 0 && (
                  <span className="ml-2 text-green-600 font-medium">Field Ready ✓</span>
                )}
              </p>
            </div>
          </div>

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
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${
                          idx > 0 ? "border-t border-gray-50" : ""
                        } ${isChecked ? "bg-green-50/30" : ""}`}
                        onClick={() => !isSaving && toggle(activeRep.user_id, item.id, isChecked)}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          isSaving
                            ? "border-gray-300 bg-gray-100"
                            : isChecked
                              ? "border-green-500 bg-green-500"
                              : "border-gray-300 bg-white"
                        }`}>
                          {isChecked && !isSaving && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isChecked ? "text-gray-500 line-through" : "text-gray-800"}`}>
                            {item.label}
                          </p>
                          {item.description && (
                            <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                          )}
                        </div>
                        {isChecked && (
                          <p className="text-xs text-gray-400 shrink-0">
                            {new Date(check.checked_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
