"use client";

import { useEffect, useState, useCallback } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { UserRole } from "@/lib/types";

interface MemberGoalRow {
  user_id: string;
  full_name: string;
  role: UserRole;
  standing: string;
  goal: {
    id: string;
    period_type: string;
    min_sales_count: number;
    min_revenue: number | null;
    team_lead_bonus: number | null;
  } | null;
  progress: { count: number; revenue: number };
  goal_met: boolean | null;
  pct_of_goal: number | null;
}

interface Team { id: string; name: string }

const STANDING_COLORS: Record<string, "green" | "yellow" | "orange" | "red"> = {
  active: "green",
  warning: "yellow",
  remedial_training: "orange",
  probation: "red",
};

const STANDING_LABELS: Record<string, string> = {
  active: "Active",
  warning: "Warning",
  remedial_training: "Remedial Training",
  probation: "Probation",
};

export default function GoalsPanel() {
  const [rows, setRows] = useState<MemberGoalRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const [targetTeamId, setTargetTeamId] = useState("");
  const [targetType, setTargetType] = useState<"user" | "team">("user");
  const [periodType, setPeriodType] = useState<"weekly" | "monthly">("monthly");
  const [minSales, setMinSales] = useState("5");
  const [minRevenue, setMinRevenue] = useState("");
  const [teamBonus, setTeamBonus] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState("");

  // Standing modal
  const [standingUser, setStandingUser] = useState<MemberGoalRow | null>(null);
  const [newStanding, setNewStanding] = useState("active");
  const [standingSaving, setStandingSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const [goalsRes, teamsRes] = await Promise.all([
      fetch("/api/manager/goals"),
      fetch("/api/manager/teams"),
    ]);
    const [goalsJson, teamsJson] = await Promise.all([goalsRes.json(), teamsRes.json()]);
    setRows(goalsJson.data ?? []);
    setTeams(teamsJson.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function assignGoal() {
    if (!minSales) { setAssignError("Minimum sales count is required"); return; }
    if (targetType === "user" && !targetUserId) { setAssignError("Select a rep"); return; }
    if (targetType === "team" && !targetTeamId) { setAssignError("Select a team"); return; }
    setAssignError(""); setAssignSaving(true);

    const res = await fetch("/api/sales-goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: targetType === "user" ? targetUserId : null,
        team_id: targetType === "team" ? targetTeamId : null,
        period_type: periodType,
        min_sales_count: parseInt(minSales),
        min_revenue: minRevenue ? parseFloat(minRevenue) : null,
        team_lead_bonus: teamBonus ? parseFloat(teamBonus) : null,
      }),
    });

    if (res.ok) {
      setAssignOpen(false);
      setMinSales("5"); setMinRevenue(""); setTeamBonus("");
      fetchData();
    } else {
      const d = await res.json();
      setAssignError(d.error ?? "Failed to assign goal");
    }
    setAssignSaving(false);
  }

  async function updateStanding() {
    if (!standingUser) return;
    setStandingSaving(true);
    await fetch(`/api/manager/members/${standingUser.user_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ standing: newStanding }),
    });
    setStandingUser(null);
    fetchData();
    setStandingSaving(false);
  }

  const atRisk = rows.filter((r) => r.goal && !r.goal_met && r.pct_of_goal !== null && r.pct_of_goal < 50);

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Sales Goals</h1>
          <p className="text-sm text-gray-500 mt-0.5">Assign minimums and track progress this month</p>
        </div>
        <Button onClick={() => setAssignOpen(true)}>Assign Goal</Button>
      </div>

      {atRisk.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">
            {atRisk.length} rep{atRisk.length !== 1 ? "s" : ""} at risk of missing their goal this period
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1,2,3].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rep</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Goal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Progress</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Standing</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => {
                const pct = row.pct_of_goal;
                const barColor = pct === null ? "bg-gray-200"
                  : pct >= 100 ? "bg-green-500"
                  : pct >= 50  ? "bg-amber-400"
                  : "bg-red-400";

                return (
                  <tr key={row.user_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-blue-700">{row.full_name.charAt(0)}</span>
                        </div>
                        <span className="font-medium text-gray-900">{row.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {row.goal ? (
                        <span>
                          {row.goal.min_sales_count} sales/{row.goal.period_type === "weekly" ? "wk" : "mo"}
                          {row.goal.min_revenue ? ` · $${row.goal.min_revenue}` : ""}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">No goal</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.goal ? (
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${barColor}`}
                              style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-700">
                            {row.progress.count}/{row.goal.min_sales_count}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">{row.progress.count} sales</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={STANDING_LABELS[row.standing] ?? row.standing}
                        color={STANDING_COLORS[row.standing] ?? "gray"}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { setStandingUser(row); setNewStanding(row.standing); }}
                        className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                      >
                        Update Standing
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Assign goal modal */}
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Sales Goal">
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            {(["user", "team"] as const).map((t) => (
              <button key={t} onClick={() => setTargetType(t)}
                className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors capitalize ${
                  targetType === t ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >{t === "user" ? "Individual Rep" : "Whole Team"}</button>
            ))}
          </div>

          {targetType === "user" ? (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Rep</label>
              <select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option value="">Select rep…</option>
                {rows.map((r) => <option key={r.user_id} value={r.user_id}>{r.full_name}</option>)}
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Team</label>
              <select value={targetTeamId} onChange={(e) => setTargetTeamId(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option value="">Select team…</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-2">
            {(["weekly", "monthly"] as const).map((p) => (
              <button key={p} onClick={() => setPeriodType(p)}
                className={`flex-1 rounded-xl border py-2 text-sm font-medium capitalize transition-colors ${
                  periodType === p ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}>{p}</button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Min sales count <span className="text-red-500">*</span></label>
              <input type="number" min={0} value={minSales} onChange={(e) => setMinSales(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Min revenue ($) <span className="text-gray-400 font-normal">optional</span></label>
              <input type="number" min={0} value={minRevenue} onChange={(e) => setMinRevenue(e.target.value)} placeholder="e.g. 2000"
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
          </div>

          {targetType === "team" && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Team lead bonus if goal met ($) <span className="text-gray-400 font-normal">optional</span></label>
              <input type="number" min={0} value={teamBonus} onChange={(e) => setTeamBonus(e.target.value)} placeholder="e.g. 250"
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
          )}

          {assignError && <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{assignError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button loading={assignSaving} onClick={assignGoal}>Assign Goal</Button>
          </div>
        </div>
      </Modal>

      {/* Standing update modal */}
      <Modal open={!!standingUser} onClose={() => setStandingUser(null)} title={`Update Standing — ${standingUser?.full_name}`}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            Changing standing to Remedial Training or Probation will be visible to the rep on their dashboard.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(STANDING_LABELS).map(([key, label]) => (
              <button key={key} onClick={() => setNewStanding(key)}
                className={`rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                  newStanding === key ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >{label}</button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStandingUser(null)}>Cancel</Button>
            <Button loading={standingSaving} onClick={updateStanding}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
