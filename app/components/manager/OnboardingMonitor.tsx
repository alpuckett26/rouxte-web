"use client";

import { useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import { UserRole } from "@/lib/types";

interface MemberRow {
  user_id: string;
  full_name: string;
  role: UserRole;
  onboarding_step: string;
  onboarding_complete: boolean;
  docs_submitted: number;
  docs_required: number;
  created_at: string;
}

const STEP_LABELS: Record<string, string> = {
  verify:    "Verify Email",
  promo:     "Welcome",
  profile:   "Profile Setup",
  documents: "HR Documents",
  complete:  "Complete",
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  sales_manager: "Manager",
  team_lead: "Team Lead",
  sales_rep: "Rep",
};

function StepBadge({ step, complete }: { step: string; complete: boolean }) {
  if (complete) return <Badge label="Complete" color="green" dot />;
  if (step === "documents") return <Badge label="Signing Docs" color="yellow" dot />;
  if (step === "profile") return <Badge label="Profile Setup" color="blue" dot />;
  if (step === "verify" || step === "promo") return <Badge label="Email Verify" color="gray" dot />;
  return <Badge label={STEP_LABELS[step] ?? step} color="gray" dot />;
}

export default function OnboardingMonitor({ embedded = false }: { embedded?: boolean }) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending">("pending");

  useEffect(() => {
    fetch("/api/manager/onboarding")
      .then((r) => r.json())
      .then((d) => { setMembers(d.data ?? []); setLoading(false); });
  }, []);

  const displayed = filter === "pending"
    ? members.filter((m) => !m.onboarding_complete)
    : members;

  const pendingCount = members.filter((m) => !m.onboarding_complete).length;

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <div className="flex items-center justify-between">
        {!embedded && (
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Onboarding Monitor</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {pendingCount > 0
                ? `${pendingCount} member${pendingCount !== 1 ? "s" : ""} still onboarding`
                : "All members have completed onboarding"}
            </p>
          </div>
        )}
        {embedded && (
          <p className="text-sm text-gray-500">
            {pendingCount > 0
              ? `${pendingCount} member${pendingCount !== 1 ? "s" : ""} still onboarding`
              : "All members have completed onboarding"}
          </p>
        )}
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {(["pending", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f === "pending" ? `Pending (${pendingCount})` : `All (${members.length})`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
          <p className="text-sm text-gray-500">
            {filter === "pending" ? "No pending onboarding — everyone is fully set up." : "No members found."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Member</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stage</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Documents</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayed.map((member) => {
                const docsProgress = member.docs_required > 0
                  ? `${member.docs_submitted}/${member.docs_required}`
                  : "—";
                const allDocsDone = member.docs_required === 0 || member.docs_submitted >= member.docs_required;

                return (
                  <tr key={member.user_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-blue-700">
                            {member.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">{member.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {ROLE_LABELS[member.role]}
                    </td>
                    <td className="px-4 py-3">
                      <StepBadge step={member.onboarding_step} complete={member.onboarding_complete} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${allDocsDone ? "text-green-600" : "text-amber-600"}`}>
                          {docsProgress}
                        </span>
                        {member.docs_required > 0 && (
                          <div className="flex gap-0.5">
                            {Array.from({ length: member.docs_required }).map((_, i) => (
                              <div
                                key={i}
                                className={`w-2 h-2 rounded-full ${
                                  i < member.docs_submitted ? "bg-green-500" : "bg-gray-200"
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(member.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
