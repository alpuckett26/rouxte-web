"use client";

import { useProfile } from "@/lib/hooks/useProfile";
import TrainingFlow from "@/components/training/TrainingFlow";
import TrainingLibrary from "@/components/training/TrainingLibrary";

export default function TrainingPage() {
  const { profile, loading } = useProfile();

  if (loading) return null;

  const isManager = profile?.role === "admin" || profile?.role === "sales_manager";

  return (
    <main className="p-4 md:p-6">
      {isManager ? <TrainingLibrary /> : <TrainingFlow />}
    </main>
  );
}
