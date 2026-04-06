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
  const [reps, setReps] = useState<RepRow[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/manager/training-progress");
    const d = await res.json();
    setReps(d.data ?? []);
    setModules(d.modules ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex flex-col gap-2">
      {[1,2,3].map((i) => <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />)}
    </div>
  );

  if (!reps.length) return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
      <p className="text-sm text-gray-400">No reps on your team yet.</p>
    </div>
  );

  // Abbreviate long module titles
  const abbr = (title: string) => title.length > 18 ? title.slice(0, 16) + "…" : title;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500">
        {reps.filter((r) => r.pct === 100).length} of {reps.length} rep{reps.length !== 1 ? "s" : ""} completed all modules.
      </p>

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="text-xs w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-gray-500 font-semibold sticky left-0 bg-gray-50 min-w-[140px]">Rep</th>
              <th className="px-3 py-3 text-gray-500 font-semibold text-center min-w-[60px]">Done</th>
              {modules.map((mod) => (
                <th key={mod.id} className="px-2 py-3 text-gray-400 font-medium text-center min-w-[60px]" title={mod.title}>
                  {abbr(mod.title)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {reps.map((rep) => (
              <tr key={rep.user_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 sticky left-0 bg-white">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-blue-700">{rep.full_name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{rep.full_name}</p>
                      {rep.field_cleared && <span className="text-green-600">✓ cleared</span>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  <span className={`font-semibold ${rep.pct === 100 ? "text-green-600" : rep.pct > 50 ? "text-yellow-600" : "text-gray-400"}`}>
                    {rep.pct}%
                  </span>
                </td>
                {rep.modules.map((mod) => (
                  <td key={mod.module_id} className="px-2 py-3 text-center">
                    {mod.quiz_passed ? (
                      <span className="text-green-500 text-base" title="Passed">✓</span>
                    ) : mod.completed_at ? (
                      <span className="text-yellow-400 text-base" title={`${mod.quiz_attempts} attempt${mod.quiz_attempts !== 1 ? "s" : ""}, not yet passed`}>⟳</span>
                    ) : (
                      <span className="text-gray-200 text-base">○</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-4 text-xs text-gray-400">
        <span><span className="text-green-500 font-medium">✓</span> Passed quiz</span>
        <span><span className="text-yellow-400 font-medium">⟳</span> Read, quiz not passed</span>
        <span><span className="text-gray-300 font-medium">○</span> Not started</span>
      </div>
    </div>
  );
}
