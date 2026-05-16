"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";

interface Team { id: string; name: string; member_count: number }
interface Person { role: string; full_name: string; user_id: string }
interface Chain { role: string; teams: Team[]; reports_to: Person[] }

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin", sales_manager: "Manager", team_lead: "Team Lead", sales_rep: "Sales Rep",
};

/**
 * Small dashboard card showing the accountability chain at a glance.
 * Renders only for sales_rep / team_lead / sales_manager — admin doesn't
 * need to be reminded who they report to (they don't).
 */
export default function AccountabilityCard() {
  const [chain, setChain] = useState<Chain | null>(null);

  useEffect(() => {
    fetch("/api/me/chain")
      .then((r) => r.json())
      .then((j) => { if (j.data) setChain(j.data); })
      .catch(() => {});
  }, []);

  if (!chain) return null;
  if (chain.role === "admin") return null;

  const isLead = chain.role === "team_lead" || chain.role === "sales_manager";
  const hasTeams = chain.teams.length > 0;
  const hasUpline = chain.reports_to.length > 0;
  if (!hasTeams && !hasUpline) return null;

  return (
    <Card padding="md">
      <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
        {chain.role === "sales_rep" ? "Your chain of command" : "Your responsibility"}
      </div>

      {isLead && hasTeams && (
        <div className="mb-3">
          <div className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
            {chain.role === "team_lead" ? "Your team" : "Your teams"}
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            {chain.teams.map((t) => (
              <Link key={t.id} href="/manager/team"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100">
                {t.name}
                <span className="text-[10px] font-mono text-blue-500">· {t.member_count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {hasUpline && (
        <div>
          <div className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">Reports to</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {chain.reports_to.map((p) => (
              <div key={p.user_id}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-200 px-3 py-1.5 text-sm">
                <span className="font-semibold text-gray-900 truncate max-w-[160px]">{p.full_name}</span>
                <span className="text-[10px] font-medium text-gray-500">{ROLE_LABEL[p.role] ?? p.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
