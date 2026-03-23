"use client";

import { useState } from "react";
import { SalesActivityLog, LogEventType } from "@/lib/types";
import { LOG_EVENT_LABELS, COMPLIANCE_EVENT_TYPES, isIncident } from "@/lib/utils/logs";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";

interface Props {
  leadId: string;
  logs: SalesActivityLog[];
  onLogAdded: (log: SalesActivityLog) => void;
}

const MANUAL_EVENT_OPTIONS = [
  { value: "note_added", label: "Note" },
  { value: "no_solicit_observed", label: "No Solicitation Sign" },
  { value: "do_not_knock_marked", label: "Do Not Knock" },
  { value: "complaint_received", label: "Complaint Received" },
  { value: "law_enforcement_contact", label: "Law Enforcement Contact" },
  { value: "trespass_warning", label: "Trespass Warning" },
  { value: "appointment_set", label: "Appointment Set" },
  { value: "appointment_missed", label: "Appointment Missed" },
  { value: "sale_submitted", label: "Sale Submitted" },
];

export default function LeadLogTab({ leadId, logs, onLogAdded }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [eventType, setEventType] = useState<LogEventType>("note_added");
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);

  async function addEntry() {
    if (!summary.trim()) return;
    setSaving(true);
    const res = await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: leadId,
        event_type: eventType,
        summary,
        is_incident: isIncident(eventType),
      }),
    });
    if (res.ok) {
      const d = await res.json();
      onLogAdded(d.data);
      setSummary("");
      setModalOpen(false);
    }
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" variant="secondary" onClick={() => setModalOpen(true)}>
          + Add Entry
        </Button>
      </div>

      {logs.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">No log entries yet.</p>
      )}

      <div className="relative">
        {logs.length > 0 && (
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-100" />
        )}
        <div className="flex flex-col gap-3">
          {logs.map((entry) => (
            <div key={entry.id} className="flex gap-3 relative">
              <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center z-10 ${
                COMPLIANCE_EVENT_TYPES.includes(entry.event_type)
                  ? "bg-red-100"
                  : entry.event_type.startsWith("manager_") || entry.event_type === "coach_note_added"
                  ? "bg-purple-100"
                  : "bg-blue-100"
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  COMPLIANCE_EVENT_TYPES.includes(entry.event_type)
                    ? "bg-red-500"
                    : entry.event_type.startsWith("manager_") || entry.event_type === "coach_note_added"
                    ? "bg-purple-500"
                    : "bg-blue-500"
                }`} />
              </div>

              <Card padding="sm" className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-gray-700">
                        {LOG_EVENT_LABELS[entry.event_type]}
                      </span>
                      {entry.is_incident && (
                        <Badge label="Incident" color="red" />
                      )}
                    </div>
                    <p className="text-sm text-gray-800">{entry.summary}</p>
                  </div>
                  <p className="text-xs text-gray-400 shrink-0">
                    {new Date(entry.ts).toLocaleString()}
                  </p>
                </div>

                {entry.signoffs && entry.signoffs.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    {entry.signoffs.map((s) => (
                      <p key={s.id} className="text-xs text-gray-500">
                        Manager {s.action} · {new Date(s.ts).toLocaleDateString()}
                        {s.note && ` — "${s.note}"`}
                      </p>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Log Entry"
      >
        <div className="flex flex-col gap-4">
          <Select
            label="Event Type"
            value={eventType}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEventType(e.target.value as LogEventType)}
            options={MANUAL_EVENT_OPTIONS}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Summary</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Describe what happened..."
              rows={3}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
            />
          </div>
          {isIncident(eventType) && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              This will be marked as an incident requiring manager review.
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={addEntry}>Save Entry</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
