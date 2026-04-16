"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
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
  leads_count: number;
  sales_this_month: number;
}

interface TeamData {
  team: { id: string; name: string; tier: number };
  members: Member[];
}

interface PendingInvite {
  id: string;
  email: string;
  token: string;
  expires_at: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  sales_manager: "Manager",
  team_lead: "Team Lead",
  sales_rep: "Rep",
};

interface Props { callerRole: UserRole }

export default function TeamLeadPanel({ callerRole }: Props) {
  const [data, setData] = useState<TeamData | null>(null);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [newInvite, setNewInvite] = useState<{ token: string; email: string; emailSent: boolean } | null>(null);

  const fetchData = useCallback(async () => {
    const [teamRes, invitesRes] = await Promise.all([
      fetch("/api/manager/my-team"),
      fetch("/api/invites"),
    ]);
    const [teamJson, invitesJson] = await Promise.all([teamRes.json(), invitesRes.json()]);
    setData(teamJson.data ?? null);
    setInvites(invitesJson.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />)}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
        <p className="text-sm text-gray-500">You are not assigned to a team yet.</p>
        <p className="text-xs text-gray-400 mt-1">Ask your manager to assign you to a team.</p>
      </div>
    );
  }

  const { team, members } = data;

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{team.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>Invite Rep</Button>
      </div>

      {newInvite && (
        <InviteLinkCard
          token={newInvite.token}
          email={newInvite.email}
          emailSent={newInvite.emailSent}
          onDismiss={() => setNewInvite(null)}
        />
      )}

      {/* Member list */}
      <div className="flex flex-col gap-3">
        {members.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">No members yet.</p>
        )}
        {members.map((member) => (
          <Card key={member.user_id} padding="md">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-blue-700">
                    {member.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{member.full_name}</p>
                  <Badge label={ROLE_LABELS[member.role]} color="gray" />
                </div>
              </div>
              <div className="flex items-center gap-6 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-900">{member.leads_count}</p>
                  <p className="text-xs text-gray-400">Leads</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-600">{member.sales_this_month}</p>
                  <p className="text-xs text-gray-400">Sales (mo.)</p>
                </div>
                <Link
                  href={`/leads?assigned_to=${member.user_id}`}
                  className="rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors"
                >
                  View Leads
                </Link>
              </div>
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
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-2.5 text-sm"
              >
                <span className="text-gray-700">{inv.email}</span>
                <span className="text-xs text-gray-400">
                  Expires {new Date(inv.expires_at).toLocaleDateString()}
                </span>
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
          fetchData();
        }}
        callerRole={callerRole}
        fixedTeamId={team.id}
      />
    </div>
  );
}
