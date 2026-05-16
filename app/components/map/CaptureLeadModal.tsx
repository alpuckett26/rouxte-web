"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";

interface Info {
  lat: number;
  lng: number;
  address?: string;
  attAvailable?: boolean | null;
}

interface Props {
  info: Info;
  onClose: () => void;
  onCreated: () => void;
}

const STATUS_OPTIONS = [
  { value: "new",        label: "New" },
  { value: "attempted",  label: "Attempted" },
  { value: "interested", label: "Interested" },
];

export default function CaptureLeadModal({ info, onClose, onCreated }: Props) {
  const [address, setAddress] = useState(info.address ?? "");
  const [status, setStatus] = useState("new");
  // Pre-fill from FCC BDC data if available; rep can still override
  const [attAvailable, setAttAvailable] = useState<boolean | null>(
    info.attAvailable !== undefined ? info.attAvailable : null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!address.trim()) {
      setError("Address is required.");
      return;
    }
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: address.trim(),
          lat: info.lat,
          lng: info.lng,
          status,
          carrier_availability: {
            att: attAvailable === true,
            competitors: [],
            max_down_mbps: null,
            max_up_mbps: null,
            tech_codes: [],
            fcc_block_id: null,
          },
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to create lead.");
      }

      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Capture Lead">
      <div className="flex flex-col gap-4">
        {/* Coordinates */}
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="font-medium text-gray-700 mb-0.5">Latitude</p>
            {info.lat.toFixed(6)}
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="font-medium text-gray-700 mb-0.5">Longitude</p>
            {info.lng.toFixed(6)}
          </div>
        </div>

        <Input
          label="Address"
          value={address}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
          placeholder="123 Main St, Austin, TX 78701"
        />

        <Select
          label="Initial Status"
          value={status}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatus(e.target.value)}
          options={STATUS_OPTIONS}
        />

        {/* AT&T availability — auto-detected from FCC BDC data when available */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-medium text-gray-700">AT&T Available?</p>
            {info.attAvailable !== undefined && info.attAvailable !== null && (
              <span className="text-xs rounded-full bg-blue-50 border border-blue-200 text-blue-600 px-2 py-0.5">
                FCC data
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {[
              { val: true, label: "✓ Yes", active: "border-green-400 bg-green-50 text-green-700" },
              { val: false, label: "✗ No", active: "border-red-300 bg-red-50 text-red-700" },
              { val: null, label: "Unknown", active: "border-gray-400 bg-gray-100 text-gray-700" },
            ].map(({ val, label, active }) => (
              <button
                key={String(val)}
                onClick={() => setAttAvailable(val)}
                className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors ${
                  attAvailable === val ? active : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {info.attAvailable !== undefined && info.attAvailable !== null
              ? "Auto-detected from FCC BDC — verify in SaraPlus before ordering"
              : "Verify in SaraPlus if unsure"}
          </p>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={handleCreate}>Save Lead</Button>
        </div>
      </div>
    </Modal>
  );
}
