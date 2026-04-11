"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CATEGORY_LABELS: Record<string, string> = {
  appearance:    "Appearance",
  documentation: "Documentation",
  training:      "Training",
  field_setup:   "Field Setup",
  general:       "General",
};
const CATEGORY_ORDER = ["appearance", "documentation", "training", "field_setup", "general"];

interface ReadinessItem {
  id: string;
  label: string;
  description: string | null;
  category: string;
  order_index: number;
  checked: boolean;
}

interface TrainingModule {
  id: string;
  title: string;
  sequence_order: number;
  completed_at: string | null;
  quiz_passed: boolean;
}

interface ShadowSession {
  id: string;
  session_date: string;
  duration_hrs: number | null;
  mentor_name: string;
  notes: string | null;
  manager_approved: boolean;
}

interface StatusData {
  profile: {
    full_name: string;
    onboarding_complete: boolean;
    field_cleared: boolean;
    field_cleared_at: string | null;
  };
  readiness: { items: ReadinessItem[]; completed: number; total: number };
  training: { modules: TrainingModule[]; completed: number; total: number };
  shadows: ShadowSession[];
}

function ProgressBar({ value, total, color = "blue" }: { value: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const colorClass = color === "green" ? "bg-green-500" : color === "yellow" ? "bg-yellow-400" : "bg-blue-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-12 text-right">{value}/{total}</span>
    </div>
  );
}

export default function RepOnboardingStatus() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "readiness" | "training" | "shadows">("overview");

  useEffect(() => {
    fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then((d) => {
        if (d && !d.error) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex flex-col gap-3 max-w-2xl">
      {[1,2,3].map((i) => <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />)}
    </div>
  );

  if (!data?.profile) return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center text-sm text-gray-400 max-w-2xl">
      Onboarding status unavailable — contact your manager if this persists.
    </div>
  );

  const { profile, readiness, training, shadows } = data;
  const approvedShadows = shadows.filter((s) => s.manager_approved).length;

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Clearance banner */}
      {profile.field_cleared ? (
        <div className="rounded-2xl bg-green-50 border border-green-200 px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 16 16">
              <path d="M3 8l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-green-800">Cleared to Work the Field</p>
            <p className="text-xs text-green-600">
              {profile.field_cleared_at ? `Approved ${new Date(profile.field_cleared_at).toLocaleDateString()}` : "Your manager has cleared you"}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 16 16">
              <path d="M8 3v5M8 11v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-800">Awaiting Field Clearance</p>
            <p className="text-xs text-amber-700">Complete your checklist and training — your manager will clear you when you're ready.</p>
          </div>
        </div>
      )}

      {/* Overview cards */}
      <div className="grid grid-cols-3 gap-3">
        <button onClick={() => setTab("readiness")} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 text-left hover:border-blue-200 transition-colors">
          <p className="text-xs text-gray-500 font-medium mb-2">Field Readiness</p>
          <p className="text-2xl font-bold text-gray-900">{readiness.completed}<span className="text-base font-normal text-gray-400">/{readiness.total}</span></p>
          <ProgressBar value={readiness.completed} total={readiness.total} color={readiness.completed === readiness.total ? "green" : "blue"} />
        </button>
        <button onClick={() => setTab("training")} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 text-left hover:border-blue-200 transition-colors">
          <p className="text-xs text-gray-500 font-medium mb-2">Training Modules</p>
          <p className="text-2xl font-bold text-gray-900">{training.completed}<span className="text-base font-normal text-gray-400">/{training.total}</span></p>
          <ProgressBar value={training.completed} total={training.total} color={training.completed === training.total ? "green" : "blue"} />
        </button>
        <button onClick={() => setTab("shadows")} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 text-left hover:border-blue-200 transition-colors">
          <p className="text-xs text-gray-500 font-medium mb-2">Shadow Sessions</p>
          <p className="text-2xl font-bold text-gray-900">{approvedShadows}<span className="text-xs font-normal text-gray-400 ml-1">approved</span></p>
          <p className="text-xs text-gray-400 mt-1">{shadows.length} total logged</p>
        </button>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-gray-100 pb-1">
        {([
          { key: "overview",  label: "Overview" },
          { key: "readiness", label: "Field Checklist" },
          { key: "training",  label: "Training" },
          { key: "shadows",   label: "Shadow Log" },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-100"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-500">Here's what you need to complete before working the field independently.</p>
          {[
            { label: "Digital Onboarding", done: profile.onboarding_complete, desc: "Email verified, profile set up, documents signed" },
            { label: "Field Readiness Checklist", done: readiness.completed === readiness.total && readiness.total > 0, desc: `${readiness.completed} of ${readiness.total} items verified by your team lead` },
            { label: "Training Modules", done: training.completed === training.total && training.total > 0, desc: `${training.completed} of ${training.total} modules passed` },
            { label: "Shadow Session", done: approvedShadows > 0, desc: "At least one approved shadow session on record" },
            { label: "Manager Clearance", done: profile.field_cleared, desc: "Your manager has signed off and cleared you" },
          ].map((step, i) => (
            <div key={i} className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${step.done ? "border-green-100 bg-green-50/50" : "border-gray-100 bg-white"}`}>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${step.done ? "border-green-500 bg-green-500" : "border-gray-300"}`}>
                {step.done && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div>
                <p className={`text-sm font-medium ${step.done ? "text-gray-500 line-through" : "text-gray-800"}`}>{step.label}</p>
                <p className="text-xs text-gray-400">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Field Readiness */}
      {tab === "readiness" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">These items are verified by your team lead. Contact them if something is incorrect.</p>
          {CATEGORY_ORDER.map((cat) => {
            const catItems = readiness.items.filter((i) => i.category === cat);
            if (!catItems.length) return null;
            return (
              <div key={cat}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{CATEGORY_LABELS[cat]}</p>
                <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                  {catItems.map((item, idx) => (
                    <div key={item.id} className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? "border-t border-gray-50" : ""}`}>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${item.checked ? "border-green-500 bg-green-500" : "border-gray-200"}`}>
                        {item.checked && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${item.checked ? "text-gray-400" : "text-gray-800"}`}>{item.label}</p>
                        {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Training */}
      {tab === "training" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-gray-500">{training.completed} of {training.total} modules passed</p>
            <Link href="/training" className="text-sm text-blue-600 font-medium hover:underline">Go to Training →</Link>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
            {training.modules.map((mod, idx) => (
              <div key={mod.id} className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? "border-t border-gray-50" : ""}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${mod.quiz_passed ? "border-green-500 bg-green-500" : mod.completed_at ? "border-yellow-400 bg-yellow-50" : "border-gray-200"}`}>
                  {mod.quiz_passed ? (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : mod.completed_at ? (
                    <span className="text-yellow-500 text-xs font-bold">!</span>
                  ) : null}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${mod.quiz_passed ? "text-gray-400" : "text-gray-800"}`}>{mod.title}</p>
                </div>
                <span className={`text-xs font-medium ${mod.quiz_passed ? "text-green-600" : mod.completed_at ? "text-yellow-600" : "text-gray-300"}`}>
                  {mod.quiz_passed ? "Passed" : mod.completed_at ? "Quiz pending" : "Not started"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shadow sessions */}
      {tab === "shadows" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-500">Shadow sessions logged by your manager or team lead.</p>
          {!shadows.length ? (
            <div className="rounded-2xl border border-dashed border-gray-200 py-10 text-center">
              <p className="text-sm text-gray-400">No shadow sessions logged yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {shadows.map((s) => (
                <div key={s.id} className="rounded-xl border border-gray-100 bg-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        Shadowed {s.mentor_name}
                        {s.duration_hrs ? ` · ${s.duration_hrs}h` : ""}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(s.session_date).toLocaleDateString()}</p>
                      {s.notes && <p className="text-xs text-gray-500 mt-1">{s.notes}</p>}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.manager_approved ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {s.manager_approved ? "Approved" : "Pending"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
