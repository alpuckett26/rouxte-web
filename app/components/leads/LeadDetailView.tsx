"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lead, LeadNote, LeadTag, SalesActivityLog } from "@/lib/types";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, LEAD_STATUS_ORDER } from "@/lib/utils/leads";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import LeadLogTab from "./LeadLogTab";

type Tab = "overview" | "notes" | "tags" | "log";

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

  async function updateStatus(newStatus: Lead["status"]) {
    if (!lead) return;
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

      {/* Status pipeline */}
      <Card padding="md">
        <p className="text-xs font-medium text-gray-500 mb-3">Pipeline Status</p>
        <div className="flex items-center gap-1 flex-wrap">
          {LEAD_STATUS_ORDER.filter((s) => s !== "closed_lost").map((s, i, arr) => {
            const currentIdx = LEAD_STATUS_ORDER.indexOf(lead.status);
            const stepIdx = LEAD_STATUS_ORDER.indexOf(s);
            const done = stepIdx < currentIdx;
            const active = s === lead.status;
            return (
              <div key={s} className="flex items-center gap-1">
                <button
                  onClick={() => updateStatus(s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-blue-600 text-white"
                      : done
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {LEAD_STATUS_LABELS[s]}
                </button>
                {i < arr.length - 1 && (
                  <span className="text-gray-300 text-xs">→</span>
                )}
              </div>
            );
          })}
          <button
            onClick={() => updateStatus("closed_lost")}
            className={`rounded-full px-3 py-1 text-xs font-medium ml-2 transition-colors ${
              lead.status === "closed_lost"
                ? "bg-red-600 text-white"
                : "bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-600"
            }`}
          >
            Closed / Lost
          </button>
        </div>
      </Card>

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
              <p className="font-medium text-gray-900">{lead.lat.toFixed(5)}, {lead.lng.toFixed(5)}</p>
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
        <div className="flex flex-wrap gap-2">
          {tags.length === 0 && (
            <p className="text-sm text-gray-400">No tags assigned.</p>
          )}
          {tags.map((lt) => (
            <Badge key={lt.id} label={lt.tag?.name ?? lt.tag_id} color="blue" />
          ))}
        </div>
      )}

      {tab === "log" && (
        <LeadLogTab leadId={leadId} logs={logs} onLogAdded={(l) => setLogs((prev) => [l, ...prev])} />
      )}
    </div>
  );
}
