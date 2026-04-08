"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";

interface DayData {
  date: string;
  knocks: number;
  sales: number;
}

export default function KnockHistoryWidget() {
  const [days, setDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/rep/knocks")
      .then((r) => r.json())
      .then((d) => setDays(d.days ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="h-32 rounded-2xl bg-gray-100 animate-pulse" />;
  }

  const maxKnocks = Math.max(...days.map((d) => d.knocks), 1);
  const totalKnocks = days.reduce((s, d) => s + d.knocks, 0);
  const totalSales = days.reduce((s, d) => s + d.sales, 0);
  const convPct = totalKnocks > 0 ? ((totalSales / totalKnocks) * 100).toFixed(1) : "0.0";

  // Show last 14 days in the chart to keep bars readable on mobile
  const visible = days.slice(-14);

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Knocks vs Sales (30 days)</p>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span><span className="font-semibold text-gray-800">{totalKnocks}</span> knocks</span>
          <span><span className="font-semibold text-green-600">{totalSales}</span> sales</span>
          <span className="text-gray-400">{convPct}% conv</span>
        </div>
      </div>

      {totalKnocks === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No knocks logged yet — tap a disposition on the map to start tracking.</p>
      ) : (
        <div className="flex items-end gap-0.5 h-20" aria-label="Knocks and sales by day">
          {visible.map((d) => {
            const knockH = Math.round((d.knocks / maxKnocks) * 100);
            const hasSale = d.sales > 0;
            const label = new Date(d.date + "T12:00:00").toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 group relative" title={`${label}: ${d.knocks} knock${d.knocks !== 1 ? "s" : ""}, ${d.sales} sale${d.sales !== 1 ? "s" : ""}`}>
                {/* Bar */}
                <div className="w-full flex flex-col justify-end" style={{ height: "64px" }}>
                  <div
                    className={`w-full rounded-t-sm transition-all ${hasSale ? "bg-green-400" : "bg-blue-300"}`}
                    style={{ height: `${Math.max(knockH, d.knocks > 0 ? 4 : 0)}%` }}
                  />
                </div>
                {/* Sale dot */}
                {hasSale && (
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3 mt-2">
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <span className="w-3 h-2 rounded-sm bg-blue-300 inline-block" /> Knock day
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <span className="w-3 h-2 rounded-sm bg-green-400 inline-block" /> Sale day
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Sale
        </span>
      </div>
    </Card>
  );
}
