import AppShell from "@/components/AppShell";
import AiCoachChat from "@/components/ai/AiCoachChat";

export default function CoachPage() {
  return (
    <AppShell>
      <div className="flex flex-col h-full gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">AI Coach</h1>
          <p className="text-sm text-gray-500">Get real-time help at the door — rebuttals, pitches, and practice mode</p>
        </div>
        <div className="flex-1 min-h-0">
          <AiCoachChat />
        </div>
      </div>
    </AppShell>
  );
}
