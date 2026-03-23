"use client";

import { useEffect, useState } from "react";
import { SalesActivityLog, SignoffAction } from "@/lib/types";
import { LOG_EVENT_LABELS } from "@/lib/utils/logs";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

export default function ManagerQueue() {
  const [incidents, setIncidents] = useState<SalesActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SalesActivityLog | null>(null);
  const [action, setAction] = useState<SignoffAction>("acknowledged");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/logs?incidents_only=true")
      .then((r) => r.json())
      .then((d) => setIncidents(d.data ?? []))
      .catch(() => setIncidents([]))
      .finally(() => setLoading(false));
  }, []);

  async function submitSignoff() {
    if (!selected) return;
    setSaving(true);
    const res = await fetch(`/api/logs/${selected.id}/signoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    if (res.ok) {
      setIncidents((prev) => prev.filter((i) => i.id !== selected.id));
      setSelected(null);
      setNote("");
    }
    setSaving(false);
  }

  const needsReview = incidents.filter(
    (i) => !i.signoffs || i.signoffs.length === 0
  );
  const reviewed = incidents.filter(
    (i) => i.signoffs && i.signoffs.length > 0
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Manager Review Queue</h1>
        <p className="text-sm text-gray-500">Incidents and exceptions requiring acknowledgement</p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : needsReview.length === 0 ? (
        <Card padding="md">
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-medium text-gray-700">All caught up</p>
            <p className="text-sm text-gray-400 mt-1">No pending incidents to review</p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-500">{needsReview.length} pending</p>
          {needsReview.map((entry) => (
            <Card key={entry.id} padding="md">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge label={LOG_EVENT_LABELS[entry.event_type]} color="red" />
                    <span className="text-xs text-gray-400">
                      {new Date(entry.ts).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800">{entry.summary}</p>
                  {entry.lead_id && (
                    <p className="text-xs text-gray-400 mt-1">Lead: {entry.lead_id}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSelected(entry);
                    setAction("acknowledged");
                    setNote("");
                  }}
                >
                  Review
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {reviewed.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Recently reviewed</p>
          <div className="flex flex-col gap-2">
            {reviewed.slice(0, 5).map((entry) => (
              <Card key={entry.id} padding="sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700">{entry.summary}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {LOG_EVENT_LABELS[entry.event_type]} · {new Date(entry.ts).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    label={entry.signoffs?.[0]?.action ?? "reviewed"}
                    color={
                      entry.signoffs?.[0]?.action === "approved"
                        ? "green"
                        : entry.signoffs?.[0]?.action === "denied"
                        ? "red"
                        : "gray"
                    }
                  />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Review Incident"
      >
        {selected && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-gray-50 p-3">
              <Badge label={LOG_EVENT_LABELS[selected.event_type]} color="red" />
              <p className="text-sm text-gray-800 mt-2">{selected.summary}</p>
              <p className="text-xs text-gray-400 mt-1">{new Date(selected.ts).toLocaleString()}</p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Action</label>
              <div className="flex gap-2">
                {(["acknowledged", "approved", "denied"] as SignoffAction[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAction(a)}
                    className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors capitalize ${
                      action === a
                        ? a === "denied"
                          ? "border-red-400 bg-red-50 text-red-700"
                          : a === "approved"
                          ? "border-green-400 bg-green-50 text-green-700"
                          : "border-blue-400 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Coaching Note <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Add context or coaching guidance..."
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelected(null)}>Cancel</Button>
              <Button loading={saving} onClick={submitSignoff}>Submit Signoff</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
