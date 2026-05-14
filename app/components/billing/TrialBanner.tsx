"use client";

import Link from "next/link";

interface Props {
  daysLeft: number;
  tierKey: string;
  pastDue?: boolean;
}

export default function TrialBanner({ daysLeft, tierKey, pastDue }: Props) {
  if (pastDue) {
    return (
      <div className="bg-red-600 text-white px-4 py-2 text-sm flex items-center justify-between gap-3">
        <div className="font-medium">
          Payment failed — your access continues for a short grace period. Please update billing.
        </div>
        <Link href="/billing" className="bg-white/15 hover:bg-white/25 px-3 py-1 rounded-md font-semibold">
          Update billing →
        </Link>
      </div>
    );
  }

  const urgent = daysLeft <= 5;
  return (
    <div className={[
      "px-4 py-2 text-sm flex items-center justify-between gap-3",
      urgent
        ? "bg-amber-50 border-b border-amber-200 text-amber-900"
        : "bg-blue-50 border-b border-blue-200 text-blue-900",
    ].join(" ")}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/70 text-xs font-bold tracking-wide uppercase">
          {tierKey} trial
        </span>
        <span className="truncate">
          {daysLeft === 0
            ? "Last day of your free trial — billing kicks in tomorrow."
            : daysLeft === 1
            ? "1 day left in your free trial."
            : `${daysLeft} days left in your free trial.`}
        </span>
      </div>
      <Link
        href="/billing"
        className={[
          "shrink-0 px-3 py-1 rounded-md font-semibold transition",
          urgent ? "bg-amber-900 text-white hover:bg-amber-950" : "bg-blue-900 text-white hover:bg-blue-950",
        ].join(" ")}
      >
        Manage billing →
      </Link>
    </div>
  );
}
