"use client";

import { useEffect, useState, useCallback } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import InviteModal from "@/components/manager/InviteModal";
import InviteLinkCard from "@/components/manager/InviteLinkCard";
import { UserRole } from "@/lib/types";

interface Member {
  user_id: string;
  full_name: string;
  role: UserRole;
  team_id: string | null;
  close_rate?: number | null;
  assigned_leads?: number;
  closed_leads?: number;
}

interface Team { id: string; name: string }

interface PendingInvite {
  id: string;
  email: string;
  role: UserRole;
  token: string;
  expires_at: string;
  team: { name: string } | null;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  sales_manager: "Manager",
  team_lead: "Team Lead",
  sales_rep: "Rep",
};

const ROLE_COLORS: Record<UserRole, "blue" | "purple" | "yellow" | "gray"> = {
  admin: "purple",
  sales_manager: "blue",
  team_lead: "yellow",
  sales_rep: "gray",
};

const ALL_ROLES: { value: UserRole; label: string }[] = [
  { value: "sales_rep", label: "Rep" },
  { value: "team_lead", label: "Team Lead" },
  { value: "sales_manager", label: "Manager" },
];

export default function PeoplePanel() {
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [newInvite, setNewInvite] = useState<{ token: string; email: string } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [membersRes, teamsRes, invitesRes] = await Promise.all([
      fetch("/api/team/members"),
      fetch("/api/manager/teams"),
      fetch("/api/invites"),
    ]);
    const [membersJson, teamsJson, invitesJson] = await Promise.all([
      membersRes.json(), teamsRes.json(), invitesRes.json(),
    ]);
    setMembers(membersJson.data ?? []);
    setTeams(teamsJson.data ?? []);
    setInvites(invitesJson.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function updateMember(userId: string, patch: { role?: UserRole; team_id?: string | null }) {
    setSaving(userId);
    await fetch(`/api/manager/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await fetchAll();
    setSaving(null);
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">People</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>Invite Member</Button>
      </div>

      {newInvite && (
        <InviteLinkCard
          token={newInvite.token}
          email={newInvite.email}
          onDismiss={() => setNewInvite(null)}
        />
      )}

      {/* Members */}
      <div className="flex flex-col gap-2">
        {members.map((member) => (
          <Card key={member.user_id} padding="sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-blue-700">
                  {member.full_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{member.full_name}</p>
              </div>

              {/* Role picker */}
              <select
                value={member.role}
                disabled={saving === member.user_id}
                onChange={(e) => updateMember(member.user_id, { role: e.target.value as UserRole })}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white disabled:opacity-50"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>

              {/* Team picker */}
              <select
                value={member.team_id ?? ""}
                disabled={saving === member.user_id}
                onChange={(e) => updateMember(member.user_id, { team_id: e.target.value || null })}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white disabled:opacity-50"
              >
                <option value="">No team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>

              {member.role === "sales_rep" && member.assigned_leads != null && member.assigned_leads > 0 && (
                <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  (member.close_rate ?? 0) >= 10
                    ? "bg-green-50 text-green-700"
                    : (member.close_rate ?? 0) >= 5
                    ? "bg-yellow-50 text-yellow-700"
                    : "bg-red-50 text-red-700"
                }`}>
                  {member.close_rate ?? 0}% close
                </div>
              )}

              <Badge
                label={ROLE_LABELS[member.role]}
                color={ROLE_COLORS[member.role]}
              />
            </div>
          </Card>
        ))}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Pending Invites</p>
          <div className="flex flex-col gap-2">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-2.5"
              >
                <div>
                  <p className="text-sm text-gray-700">{inv.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ROLE_LABELS[inv.role]}
                    {inv.team ? ` · ${inv.team.name}` : ""}
                    {" · Expires "}{new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge label="Pending" color="yellow" />
              </div>
            ))}
          </div>
        </div>
      )}

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onCreated={(invite) => {
          setInviteOpen(false);
          setNewInvite(invite);
          fetchAll();
        }}
        callerRole="sales_manager"
      />
    </div>
  );
}
