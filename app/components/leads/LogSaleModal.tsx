"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

interface Props {
  leadId: string;
  address: string;
  onClose: () => void;
  onLogged: () => void;
}

export default function LogSaleModal({ leadId, address, onClose, onLogged }: Props) {
  const [customerName, setCustomerName] = useState("");
  const [packageSold, setPackageSold] = useState("");
  const [installDate, setInstallDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!customerName.trim()) { setError("Customer name is required"); return; }
    if (!packageSold.trim()) { setError("Package sold is required"); return; }
    setError("");
    setSaving(true);

    try {
      // Log the sale event
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "sale_submitted",
          summary: `Sale: ${packageSold} — ${customerName}`,
          lead_id: leadId,
          metadata: {
            customer_name: customerName.trim(),
            package_sold: packageSold.trim(),
            install_date: installDate || null,
            notes: notes.trim() || null,
          },
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to log sale");
      }

      onLogged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Log Sale">
      <div className="flex flex-col gap-4">
        <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2">
          <p className="text-xs text-green-700 font-medium">Sale at</p>
          <p className="text-sm text-green-900">{address}</p>
        </div>

        <Input
          label="Customer name"
          value={customerName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerName(e.target.value)}
          placeholder="John Smith"
        />

        <Input
          label="Package sold"
          value={packageSold}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPackageSold(e.target.value)}
          placeholder="e.g. 1Gig Internet + TV"
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Requested install date <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="date"
            value={installDate}
            onChange={(e) => setInstallDate(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Notes <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any special instructions, objections handled, etc."
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
          />
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Skip</Button>
          <Button loading={saving} onClick={handleSubmit}>Log Sale</Button>
        </div>
      </div>
    </Modal>
  );
}
