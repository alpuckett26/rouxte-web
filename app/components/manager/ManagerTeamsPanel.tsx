"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";

interface TeamRow {
  id: string;
  name: string;
  tier: number;
  member_count: number;
  leads_count: number;
  sales_this_month: number;
}

export default function ManagerTeamsPanel() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchTeams = useCallback(async () => {
    const res = await fetch("/api/manager/teams");
    const d = await res.json();
    setTeams(d.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  async function handleCreate() {
    if (!newName.trim()) { setCreateError("Name is required"); return; }
    setCreateError("");
    setCreating(true);
    const res = await fetch("/api/manager/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      setNewName("");
      setCreateOpen(false);
      fetchTeams();
    } else {
      const d = await res.json();
      setCreateError(d.error ?? "Failed to create team");
    }
    setCreating(false);
  }

  const totalMembers = teams.reduce((s, t) => s + t.member_count, 0);
  const totalSales = teams.reduce((s, t) => s + t.sales_this_month, 0);

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">All Teams</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {teams.length} team{teams.length !== 1 ? "s" : ""} · {totalMembers} members · {totalSales} sales this month
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>New Team</Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : teams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
          <p className="text-sm text-gray-500 mb-3">No teams yet.</p>
          <Button variant="secondary" onClick={() => setCreateOpen(true)}>Create first team</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/manager/teams/${team.id}`}
              className="block rounded-2xl border border-gray-200 bg-white px-4 py-4 hover:bg-blue-50 hover:border-blue-200 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">{team.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Tier {team.tier}
                  </p>
                </div>
                <div className="flex items-center gap-6 text-center">
                  <div>
                    <p className="text-lg font-bold text-gray-900">{team.member_count}</p>
                    <p className="text-xs text-gray-400">Members</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">{team.leads_count}</p>
                    <p className="text-xs text-gray-400">Leads</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">{team.sales_this_month}</p>
                    <p className="text-xs text-gray-400">Sales (mo.)</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Team">
        <div className="flex flex-col gap-4">
          <Input
            label="Team name"
            value={newName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
            placeholder="e.g. North Austin"
          />
          {createError && (
            <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              {createError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={creating} onClick={handleCreate}>Create Team</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
