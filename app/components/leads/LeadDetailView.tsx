"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lead, LeadNote, LeadStatus, LeadTag, SalesActivityLog } from "@/lib/types";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, LEAD_STATUS_ORDER, isBackwardsTransition } from "@/lib/utils/leads";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import LeadLogTab from "./LeadLogTab";
import LeadAIPanel from "./LeadAIPanel";
import LeadTagsTab from "./LeadTagsTab";
import LogSaleModal from "./LogSaleModal";

type Tab = "overview" | "notes" | "tags" | "log" | "ai";

interface Props {
  leadId: string;
}

export default function LeadDetailView({ leadId }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [tags, setTags] = useState<LeadTag[]>([]);
  const [logs, setLogs] = useState<SalesActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [logSaleOpen, setLogSaleOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/leads/${leadId}`).then((r) => r.json()),
      fetch(`/api/leads/${leadId}/notes`).then((r) => r.json()),
      fetch(`/api/leads/${leadId}/tags`).then((r) => r.json()),
      fetch(`/api/logs?lead_id=${leadId}`).then((r) => r.json()),
    ])
      .then(([leadData, notesData, tagsData, logsData]) => {
        setLead(leadData.data);
        setNotes(notesData.data ?? []);
        setTags(tagsData.data ?? []);
        setLogs(logsData.data ?? []);
      })
      .finally(() => setLoading(false));
  }, [leadId]);

  async function updateStatus(newStatus: Lead["status"], opts: { confirmBackwards?: boolean } = {}) {
    if (!lead) return;
    // Sold is only reachable through the explicit "Log a sale" flow — keep
    // status changes and sale logging atomic. See /api/leads/[id]/log-sale.
    if (newStatus === "sold") { setLogSaleOpen(true); return; }
    if (opts.confirmBackwards && isBackwardsTransition(lead.status, newStatus)) {
      const ok = window.confirm(
        `Move this lead back to "${LEAD_STATUS_LABELS[newStatus]}" from "${LEAD_STATUS_LABELS[lead.status]}"? This is an unusual transition.`,
      );
      if (!ok) return;
    }
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const d = await res.json();
      setLead(d.data);
    }
  }

  async function addNote() {
    if (!newNote.trim()) return;
    setSavingNote(true);
    const res = await fetch(`/api/leads/${leadId}/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newNote }),
    });
    if (res.ok) {
      const d = await res.json();
      setNotes((prev) => [d.data, ...prev]);
      setNewNote("");
    }
    setSavingNote(false);
  }

  async function markDNK() {
    await fetch(`/api/leads/${leadId}/dnk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Manual DNK mark" }),
    });
    setLead((prev) => prev ? { ...prev, is_do_not_knock: true } : prev);
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-8 w-48 rounded-xl bg-gray-100 animate-pulse" />
        <div className="h-48 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-24 text-gray-500">
        Lead not found.{" "}
        <button onClick={() => router.back()} className="text-blue-600 hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "notes", label: `Notes (${notes.length})` },
    { key: "tags", label: `Tags (${tags.length})` },
    { key: "log", label: `Log (${logs.length})` },
    { key: "ai", label: "AI Coach" },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => router.back()}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              ← Leads
            </button>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">{lead.address}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge
              label={LEAD_STATUS_LABELS[lead.status]}
              color={LEAD_STATUS_COLORS[lead.status]}
              dot
            />
            {lead.is_do_not_knock && (
              <Badge label="Do Not Knock" color="red" />
            )}
            {lead.is_opt_out && (
              <Badge label="Opt-Out" color="red" />
            )}
            {lead.carrier_availability?.att && (
              <Badge label="AT&T Available" color="green" />
            )}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          {!lead.is_do_not_knock && (
            <Button variant="danger" size="sm" onClick={markDNK}>
              Mark DNK
            </Button>
          )}
        </div>
      </div>

      {/* Action panel — replaces the always-clickable chip strip */}
      <LeadActionPanel
        lead={lead}
        onTransition={(next) => updateStatus(next)}
        onTransitionWithConfirm={(next) => updateStatus(next, { confirmBackwards: true })}
        onLogSale={() => setLogSaleOpen(true)}
        onJumpToTab={(t) => setTab(t)}
      />
      {logSaleOpen && lead && (
        <LogSaleModal
          leadId={lead.id}
          address={lead.address}
          onClose={() => setLogSaleOpen(false)}
          onLogged={async () => {
            setLogSaleOpen(false);
            // Refresh lead + logs after atomic sale
            const [leadData, logsData] = await Promise.all([
              fetch(`/api/leads/${leadId}`).then((r) => r.json()),
              fetch(`/api/logs?lead_id=${leadId}`).then((r) => r.json()),
            ]);
            setLead(leadData.data);
            setLogs(logsData.data ?? []);
          }}
        />
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-100 gap-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <Card padding="md">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500">Address</p>
              <p className="font-medium text-gray-900">{lead.address}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Coordinates</p>
              <p className="font-medium text-gray-900">
                {lead.lat != null && lead.lng != null ? `${lead.lat.toFixed(5)}, ${lead.lng.toFixed(5)}` : "No coordinates"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Max Download</p>
              <p className="font-medium text-gray-900">
                {lead.carrier_availability?.max_down_mbps ?? "—"} Mbps
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Technology</p>
              <p className="font-medium text-gray-900">
                {lead.carrier_availability?.tech_codes?.join(", ") || "—"}
              </p>
            </div>
            {lead.follow_up_at && (
              <div>
                <p className="text-xs text-gray-500">Follow-up</p>
                <p className="font-medium text-gray-900">
                  {new Date(lead.follow_up_at).toLocaleDateString()}
                </p>
              </div>
            )}
            {lead.appointment_at && (
              <div>
                <p className="text-xs text-gray-500">Appointment</p>
                <p className="font-medium text-gray-900">
                  {new Date(lead.appointment_at).toLocaleString()}
                </p>
              </div>
            )}
            <div className="col-span-2">
              <AssignRepField leadId={leadId} assignedTo={lead.assigned_to} onAssigned={(uid) => setLead((l) => l ? { ...l, assigned_to: uid } : l)} />
            </div>
          </div>
        </Card>
      )}

      {tab === "notes" && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note..."
              rows={2}
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
            />
            <Button size="sm" loading={savingNote} onClick={addNote} className="self-end">
              Save
            </Button>
          </div>
          {notes.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No notes yet.</p>
          )}
          {notes.map((note) => (
            <Card key={note.id} padding="sm">
              <p className="text-sm text-gray-800">{note.body}</p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(note.ts).toLocaleString()}
              </p>
            </Card>
          ))}
        </div>
      )}

      {tab === "tags" && (
        <LeadTagsTab
          leadId={leadId}
          tags={tags}
          onTagsChanged={setTags}
        />
      )}

      {tab === "log" && (
        <LeadLogTab leadId={leadId} logs={logs} onLogAdded={(l) => setLogs((prev) => [l, ...prev])} />
      )}

      {tab === "ai" && lead && (
        <LeadAIPanel lead={lead} lastNote={notes[0]?.body} />
      )}

    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  Action panel — replaces the chip strip                                  */
/* ════════════════════════════════════════════════════════════════════════ */

function LeadActionPanel({
  lead, onTransition, onTransitionWithConfirm, onLogSale, onJumpToTab,
}: {
  lead: Lead;
  onTransition: (next: LeadStatus) => void;
  onTransitionWithConfirm: (next: LeadStatus) => void;
  onLogSale: () => void;
  onJumpToTab: (t: Tab) => void;
}) {
  const elapsed = formatElapsed(lead.updated_at);

  // Primary / secondary CTA per current status
  const cta = (() => {
    switch (lead.status) {
      case "new":
        return { primary: { label: "Mark attempted",    onClick: () => onTransition("attempted") },
                 secondary: { label: "Mark interested", onClick: () => onTransition("interested") } };
      case "attempted":
        return { primary: { label: "Mark interested", onClick: () => onTransition("interested") },
                 secondary: { label: "Mark lost",     onClick: () => onTransition("lost") } };
      case "interested":
        return { primary: { label: "Log a sale",      onClick: onLogSale },
                 secondary: { label: "Set appointment", onClick: () => onTransition("appointment") } };
      case "appointment":
        return { primary: { label: "Log a sale", onClick: onLogSale },
                 secondary: { label: "Mark lost", onClick: () => onTransition("lost") } };
      case "sold":
        return { primary: { label: "View activity log", onClick: () => onJumpToTab("log") } };
      case "lost":
        return { primary: { label: "Reopen as interested", onClick: () => onTransitionWithConfirm("interested") } };
    }
  })();

  return (
    <Card padding="md">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge label={LEAD_STATUS_LABELS[lead.status]} color={LEAD_STATUS_COLORS[lead.status]} dot />
          <span className="text-xs text-gray-500">· {elapsed}</span>
        </div>
        <ChangeStatusDropdown current={lead.status} onChange={onTransitionWithConfirm} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={cta.primary.onClick}>
          {cta.primary.label}
        </Button>
        {"secondary" in cta && cta.secondary && (
          <Button variant="secondary" onClick={cta.secondary.onClick}>
            {cta.secondary.label}
          </Button>
        )}
      </div>
    </Card>
  );
}

function ChangeStatusDropdown({
  current, onChange,
}: { current: LeadStatus; onChange: (next: LeadStatus) => void }) {
  const ALL: LeadStatus[] = [...LEAD_STATUS_ORDER, "lost"];
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500">Change status</span>
      <select
        value={current}
        onChange={(e) => {
          const next = e.target.value as LeadStatus;
          if (next !== current) onChange(next);
        }}
        className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
      >
        {ALL.map((s) => (
          <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
        ))}
      </select>
    </div>
  );
}

function formatElapsed(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60_000) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Inline assign-rep field ───────────────────────────────────────────────────
function AssignRepField({
  leadId,
  assignedTo,
  onAssigned,
}: {
  leadId: string;
  assignedTo: string | null;
  onAssigned: (uid: string | null) => void;
}) {
  const [reps, setReps] = useState<{ user_id: string; full_name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/team/members")
      .then((r) => r.json())
      .then((d) => setReps(d.data ?? []));
  }, []);

  async function assign(userId: string | null) {
    setSaving(true);
    await fetch(`/api/leads/${leadId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assign_to: userId }),
    });
    onAssigned(userId);
    setSaving(false);
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">Assigned Rep</p>
      <select
        value={assignedTo ?? ""}
        disabled={saving}
        onChange={(e) => assign(e.target.value || null)}
        className="rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"
      >
        <option value="">Unassigned</option>
        {reps.map((r) => (
          <option key={r.user_id} value={r.user_id}>{r.full_name}</option>
        ))}
      </select>
    </div>
  );
}
