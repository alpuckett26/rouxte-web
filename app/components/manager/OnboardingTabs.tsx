"use client";

import { useState } from "react";
import OnboardingMonitor from "@/components/manager/OnboardingMonitor";
import RepReadinessPanel from "@/components/manager/RepReadinessPanel";
import TrainingProgressPanel from "@/components/manager/TrainingProgressPanel";

export default function OnboardingTabs() {
  const [tab, setTab] = useState<"onboarding" | "readiness" | "training">("onboarding");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Onboarding</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Track digital onboarding, field readiness, and training progress for every rep.
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-100 pb-1">
        {([
          { key: "onboarding", label: "Digital Onboarding" },
          { key: "readiness",  label: "Field Readiness" },
          { key: "training",   label: "Training Progress" },
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

      {tab === "onboarding" && <OnboardingMonitor embedded />}
      {tab === "readiness"  && <RepReadinessPanel />}
      {tab === "training"   && <TrainingProgressPanel />}
    </div>
  );
}
