"use client";

import { useState } from "react";
import { useProfile } from "@/lib/hooks/useProfile";
import TrainingFlow from "@/components/training/TrainingFlow";
import TrainingLibrary from "@/components/training/TrainingLibrary";
import RepOnboardingStatus from "@/components/onboarding/RepOnboardingStatus";

export default function TrainingPage() {
  const { profile, loading } = useProfile();
  const [tab, setTab] = useState<"training" | "status">("training");

  if (loading) return null;

  const isManager = profile?.role === "admin" || profile?.role === "sales_manager";

  if (isManager) {
    return (
      <main className="p-4 md:p-6">
        <TrainingLibrary />
      </main>
    );
  }

  return (
    <main className="p-4 md:p-6">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
        {([
          { key: "training", label: "Training Modules",    icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          )},
          { key: "status",   label: "Onboarding Status",  icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )},
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
              tab === t.key
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "training" ? <TrainingFlow /> : <RepOnboardingStatus />}
    </main>
  );
}
