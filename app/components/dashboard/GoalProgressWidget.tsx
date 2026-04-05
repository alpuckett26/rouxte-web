"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface GoalProgress {
  goal: { period_type: string; min_sales_count: number; min_revenue: number | null };
  period: { label: string; days_left: number };
  progress: { count: number; revenue: number; goal_met: boolean };
  standing: string;
}

const STANDING_STYLES: Record<string, { bar: string; bg: string; text: string; label: string }> = {
  active:            { bar: "bg-blue-500",   bg: "bg-blue-50",   text: "text-blue-700",  label: "" },
  warning:           { bar: "bg-amber-400",  bg: "bg-amber-50",  text: "text-amber-700", label: "Warning" },
  remedial_training: { bar: "bg-orange-500", bg: "bg-orange-50", text: "text-orange-700",label: "Remedial Training" },
  probation:         { bar: "bg-red-500",    bg: "bg-red-50",    text: "text-red-700",   label: "Probation" },
};

export default function GoalProgressWidget() {
  const [data, setData] = useState<GoalProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sales-goals/progress")
      .then((r) => r.json())
      .then((d) => { setData(d.data ?? null); setLoading(false); });
  }, []);

  if (loading) return <div className="h-28 rounded-2xl bg-gray-100 animate-pulse" />;
  if (!data) return null;

  const { goal, period, progress } = data;
  const pct = goal.min_sales_count > 0
    ? Math.min(100, Math.round((progress.count / goal.min_sales_count) * 100))
    : 100;
  const style = STANDING_STYLES[data.standing] ?? STANDING_STYLES.active;
  const barColor = progress.goal_met ? "bg-green-500" : style.bar;

  return (
    <div className={`rounded-2xl border p-4 ${data.standing !== "active" ? `${style.bg} border-current` : "bg-white border-gray-100 shadow-sm"}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${data.standing !== "active" ? style.text : "text-gray-500"}`}>
            {data.standing !== "active" ? style.label : `${period.label} Goal`}
          </p>
          <p className="text-sm text-gray-700 mt-0.5">
            {progress.count} / {goal.min_sales_count} sales
            {goal.min_revenue ? ` · $${progress.revenue.toLocaleString()} / $${goal.min_revenue.toLocaleString()}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${progress.goal_met ? "text-green-600" : "text-gray-900"}`}>{pct}%</p>
          <p className="text-xs text-gray-400">{period.days_left}d left</p>
        </div>
      </div>

      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {progress.goal_met && (
        <p className="text-xs text-green-600 font-medium mt-2">Goal met this period!</p>
      )}
      {data.standing === "remedial_training" && (
        <p className="text-xs mt-2 text-orange-700">You are currently in a remedial training period. Contact your manager.</p>
      )}
      {data.standing === "probation" && (
        <p className="text-xs mt-2 text-red-700 font-medium">You are on probation. Please speak with your manager immediately.</p>
      )}
    </div>
  );
}
