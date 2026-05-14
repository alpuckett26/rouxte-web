"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";

interface Totals {
  sales: number;
  quotes_sent: number;
  wireless_attached: number;
  attach_rate_pct: number;
}

export default function AnalyticsSummaryCard() {
  const [totals, setTotals] = useState<Totals | null>(null);

  useEffect(() => {
    fetch("/api/analytics/sales-history?range=7d")
      .then((r) => r.json())
      .then((j) => { if (j.totals) setTotals(j.totals); })
      .catch(() => {});
  }, []);

  return (
    <Link href="/analytics" className="block group">
      <Card padding="md" className="hover:border-blue-200 hover:shadow-md transition">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-gray-500">This week</div>
            <div className="text-sm font-semibold text-gray-900">Business pulse</div>
          </div>
          <span className="text-xs font-semibold text-blue-600 group-hover:underline">Open analytics →</span>
        </div>
        {!totals ? (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Sales"   value={totals.sales}        tone="green" />
            <Stat label="Quotes"  value={totals.quotes_sent}  tone="blue" />
            <Stat label="Attach"  value={`${totals.attach_rate_pct}%`} tone="purple" />
          </div>
        )}
      </Card>
    </Link>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone: "green" | "blue" | "purple" }) {
  const accent: Record<string, string> = {
    green:  "text-green-700",
    blue:   "text-blue-700",
    purple: "text-purple-700",
  };
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-xl font-bold ${accent[tone]} tabular-nums`}>{value}</div>
    </div>
  );
}
