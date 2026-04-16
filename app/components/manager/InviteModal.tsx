"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { UserRole } from "@/lib/types";

interface Team { id: string; name: string }
interface InviteResult { token: string; email: string }

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (invite: InviteResult) => void;
  callerRole: UserRole;
  /** If set, invite is pinned to this team (team_lead mode) */
  fixedTeamId?: string | null;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "sales_rep", label: "Sales Rep" },
  { value: "team_lead", label: "Team Lead" },
  { value: "sales_manager", label: "Sales Manager" },
];

export default function InviteModal({ open, onClose, onCreated, callerRole, fixedTeamId }: Props) {
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [role, setRole] = useState<UserRole>("sales_rep");
  const [teamId, setTeamId] = useState<string>(fixedTeamId ?? "");
  const [teams, setTeams] = useState<Team[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailValid = EMAIL_RE.test(email.trim());
  const emailError = emailTouched && !emailValid ? "Enter a valid email address" : "";

  const canPickTeam = !fixedTeamId && ["admin", "sales_manager"].includes(callerRole);

  useEffect(() => {
    if (!canPickTeam) return;
    fetch("/api/manager/teams")
      .then((r) => r.json())
      .then((d) => setTeams(d.data ?? []));
  }, [canPickTeam]);

  async function handleSubmit() {
    setEmailTouched(true);
    if (!emailValid) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          role,
          team_id: fixedTeamId ?? (teamId || null),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to create invite");
      onCreated({ token: d.data.token, email: d.data.email });
      setEmail("");
      setEmailTouched(false);
      setRole("sales_rep");
      setTeamId("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite Team Member">
      <div className="flex flex-col gap-4">
        <Input
          label="Email address"
          type="email"
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setEmail(e.target.value);
            setEmailTouched(true);
          }}
          placeholder="rep@example.com"
          error={emailError}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"
          >
            {ROLE_OPTIONS.filter((o) => {
              // team_lead can only invite sales_rep
              if (callerRole === "team_lead") return o.value === "sales_rep";
              return true;
            }).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {canPickTeam && teams.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Assign to team <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"
            >
              <option value="">No team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={handleSubmit}>Send Invite</Button>
        </div>
      </div>
    </Modal>
  );
}
