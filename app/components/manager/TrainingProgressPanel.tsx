"use client";

import { useEffect, useState, useCallback } from "react";

interface ModuleStatus {
  module_id: string;
  title: string;
  sequence_order: number;
  completed_at: string | null;
  quiz_passed: boolean;
  quiz_attempts: number;
}

interface RepRow {
  user_id: string;
  full_name: string;
  field_cleared: boolean;
  promotion_eligible: boolean;
  promotion_eligible_at: string | null;
  modules: ModuleStatus[];
  completed: number;
  total: number;
  pct: number;
}

interface Module {
  id: string;
  title: string;
  sequence_order: number;
}

export default function TrainingProgressPanel() {
  const [reps, setReps]       = useState<RepRow[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/manager/training-progress");
    const d   = await res.json();
    setReps(d.data ?? []);
    setModules(d.modules ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)}
      </div>
    );
  }

  if (!reps.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
        <p className="text-sm text-gray-500">No reps on your team yet.</p>
      </div>
    );
  }

  const abbr = (title: string) => title.length > 16 ? title.slice(0, 14) + "…" : title;
  const eligibleCount = reps.filter((r) => r.promotion_eligible).length;

  return (
    <div className="flex flex-col gap-4">

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-sm text-gray-300 font-medium">
            <span className="font-bold text-white">{reps.filter((r) => r.pct === 100).length}</span> of {reps.length} fully trained
          </span>
        </div>
        {eligibleCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-2.5">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
            <span className="text-sm text-amber-300 font-medium">
              <span className="font-bold text-amber-200">{eligibleCount}</span> promotion eligible
            </span>
          </div>
        )}
      </div>

      {/* Matrix table */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
        <table className="text-xs w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-4 py-3 text-gray-400 font-semibold sticky left-0 bg-[#0d1117] min-w-[160px]">Rep</th>
              <th className="px-3 py-3 text-gray-400 font-semibold text-center min-w-[56px]">Score</th>
              <th className="px-3 py-3 text-gray-400 font-semibold text-center min-w-[72px]">Status</th>
              {modules.map((mod) => (
                <th
                  key={mod.id}
                  title={mod.title}
                  className="px-2 py-3 text-gray-500 font-medium text-center min-w-[56px]"
                >
                  {abbr(mod.title)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {reps.map((rep) => (
              <tr key={rep.user_id} className="hover:bg-white/[0.03] transition-colors">

                {/* Rep name */}
                <td className="px-4 py-3 sticky left-0 bg-[#0d1117]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/30 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-blue-400">{rep.full_name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-200">{rep.full_name}</p>
                      {rep.field_cleared && (
                        <span className="text-emerald-500 text-[10px] font-medium">Field cleared</span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Score % */}
                <td className="px-3 py-3 text-center">
                  <span className={`font-bold tabular-nums ${
                    rep.pct === 100 ? "text-emerald-400"
                    : rep.pct >= 50  ? "text-amber-400"
                    :                  "text-gray-500"
                  }`}>
                    {rep.pct}%
                  </span>
                </td>

                {/* Promotion eligible / cleared badge */}
                <td className="px-3 py-3 text-center">
                  {rep.promotion_eligible ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Eligible
                    </span>
                  ) : rep.field_cleared ? (
                    <span className="text-emerald-500 text-[10px] font-medium">Cleared</span>
                  ) : (
                    <span className="text-gray-700 text-[10px]">—</span>
                  )}
                </td>

                {/* Per-module dots */}
                {rep.modules.map((mod) => (
                  <td key={mod.module_id} className="px-2 py-3 text-center">
                    {mod.quiz_passed ? (
                      <span className="inline-flex w-5 h-5 rounded-full bg-emerald-500/20 items-center justify-center mx-auto">
                        <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </span>
                    ) : mod.completed_at ? (
                      <span className="inline-flex w-5 h-5 rounded-full bg-amber-500/15 items-center justify-center mx-auto" title={`${mod.quiz_attempts} attempt${mod.quiz_attempts !== 1 ? "s" : ""}, not passed`}>
                        <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                      </span>
                    ) : (
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-white/10 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500/30 inline-block" /> Quiz passed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500/30 inline-block" /> Attempted, not passed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-white/10 inline-block" /> Not started
        </span>
      </div>
    </div>
  );
}
