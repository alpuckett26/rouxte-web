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
  fccData?: {
    att_available: boolean;
    att_max_down: number | null;
    att_max_up: number | null;
    competitors: string[];
    tech_codes: string[];
  } | null;
}

interface Props {
  info: Info;
  onClose: () => void;
  onCreated: () => void;
}

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "attempted", label: "Attempted" },
  { value: "contacted", label: "Contacted" },
];

export default function CaptureLeadModal({ info, onClose, onCreated }: Props) {
  const [address, setAddress] = useState(info.address ?? "");
  const [status, setStatus] = useState("new");
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
          carrier_availability: info.fccData
            ? {
                att: info.fccData.att_available,
                competitors: info.fccData.competitors,
                max_down_mbps: info.fccData.att_max_down,
                max_up_mbps: info.fccData.att_max_up,
                tech_codes: info.fccData.tech_codes,
                fcc_block_id: null,
              }
            : {},
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
        {/* FCC summary if available */}
        {info.fccData && (
          <div className={`rounded-xl px-3 py-2 flex items-center gap-2 text-sm ${
            info.fccData.att_available
              ? "bg-green-50 border border-green-200"
              : "bg-gray-50 border border-gray-200"
          }`}>
            <span className={info.fccData.att_available ? "text-green-600 text-base" : "text-gray-400 text-base"}>
              {info.fccData.att_available ? "✓" : "✗"}
            </span>
            <span className={info.fccData.att_available ? "text-green-700 font-medium" : "text-gray-500"}>
              AT&T {info.fccData.att_available ? `Available — ${info.fccData.att_max_down ?? "?"}↓ Mbps` : "Not Available"}
            </span>
          </div>
        )}

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
