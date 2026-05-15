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

const ROLE_OPTIONS: { value: UserRole; label: string; blurb: string }[] = [
  { value: "sales_rep",     label: "Sales Rep",     blurb: "Knocks doors, logs sales" },
  { value: "team_lead",     label: "Team Lead",     blurb: "Light manager queue + Select Area on map" },
  { value: "sales_manager", label: "Sales Manager", blurb: "Full manager suite, sign-off, payroll" },
];

export default function InviteModal({ open, onClose, onCreated, callerRole, fixedTeamId }: Props) {
  const [email, setEmail]           = useState("");
  const [emailTouched, setEmailT]   = useState(false);
  const [fullName, setFullName]     = useState("");
  const [phone, setPhone]           = useState("");
  const [role, setRole]             = useState<UserRole>("sales_rep");
  const [teamId, setTeamId]         = useState<string>(fixedTeamId ?? "");
  const [territory, setTerritory]   = useState("");
  const [personalNote, setNote]     = useState("");
  const [teams, setTeams]           = useState<Team[]>([]);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailValid = EMAIL_RE.test(email.trim());
  const emailError = emailTouched && !emailValid ? "Enter a valid email address" : "";
  const nameValid  = fullName.trim().length > 0;

  const canPickTeam = !fixedTeamId && ["admin", "sales_manager"].includes(callerRole);

  useEffect(() => {
    if (!canPickTeam) return;
    fetch("/api/manager/teams")
      .then((r) => r.json())
      .then((d) => setTeams(d.data ?? []));
  }, [canPickTeam]);

  function reset() {
    setEmail(""); setFullName(""); setPhone(""); setRole("sales_rep");
    setTeamId(""); setTerritory(""); setNote(""); setEmailT(false); setError("");
  }

  async function handleSubmit() {
    setEmailT(true);
    if (!emailValid || !nameValid) {
      if (!nameValid) setError("Full name is required");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          role,
          team_id: fixedTeamId ?? (teamId || null),
          personal_note: personalNote.trim() || null,
          territory_zips: territory.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to create invite");
      onCreated({ token: d.data.token, email: d.data.email });
      reset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const availableRoles = ROLE_OPTIONS.filter((o) => {
    if (callerRole === "team_lead") return o.value === "sales_rep";
    return true;
  });

  return (
    <Modal open={open} onClose={onClose} title="Invite Team Member">
      <div className="flex flex-col gap-5">

        {/* Identity */}
        <div className="grid sm:grid-cols-2 gap-3">
          <Input
            label="Full name *"
            type="text"
            value={fullName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
            placeholder="Elise Carter"
          />
          <Input
            label="Phone (optional)"
            type="tel"
            value={phone}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
            placeholder="(512) 555-0142"
          />
        </div>

        <Input
          label="Email address *"
          type="email"
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setEmail(e.target.value); setEmailT(true); }}
          placeholder="elise@yourteam.com"
          error={emailError}
        />

        {/* Role — visual cards */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Role</label>
          <div className="grid gap-2">
            {availableRoles.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setRole(o.value)}
                className={[
                  "text-left rounded-xl border-2 px-3 py-2 transition",
                  role === o.value
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white hover:bg-gray-50",
                ].join(" ")}
              >
                <div className="flex items-center gap-2">
                  <span className={[
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                    role === o.value ? "border-blue-600" : "border-gray-300",
                  ].join(" ")}>
                    {role === o.value && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                  </span>
                  <div className="flex-1">
                    <div className={`text-sm font-semibold ${role === o.value ? "text-blue-900" : "text-gray-900"}`}>{o.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{o.blurb}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Placement */}
        {canPickTeam && teams.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Team <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"
            >
              <option value="">No team yet</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Starting territory <span className="text-gray-400 font-normal">(optional ZIP codes)</span>
          </label>
          <input
            type="text"
            value={territory}
            onChange={(e) => setTerritory(e.target.value)}
            placeholder="78704, 78745"
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <p className="text-[11px] text-gray-500">
            Comma-separated. We'll pre-fetch FCC coverage for them so the new rep hits the ground running.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Personal note <span className="text-gray-400 font-normal">(optional, shown in the invite email)</span>
          </label>
          <textarea
            value={personalNote}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Hey Elise — welcome aboard. Looking forward to having you on the team. Ping me with any questions."
            rows={3}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={handleSubmit} disabled={!emailValid || !nameValid}>Send Invite</Button>
        </div>
      </div>
    </Modal>
  );
}
