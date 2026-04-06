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
      <div className="flex gap-1 border-b border-gray-100 pb-1 mb-5">
        {([
          { key: "training", label: "Training Modules" },
          { key: "status",   label: "My Onboarding Status" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "training" ? <TrainingFlow /> : <RepOnboardingStatus />}
    </main>
  );
}
