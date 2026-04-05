"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

interface Package { id: string; name: string; speed_mbps: number | null; payout_amount: number; category: string; chargeback_days: number }
interface Tier { id: string; name: string; commission_pct: number }

interface Props {
  leadId: string;
  address: string;
  onClose: () => void;
  onLogged: () => void;
}

export default function LogSaleModal({ leadId, address, onClose, onLogged }: Props) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [myTier, setMyTier] = useState<Tier | null>(null);
  const [selectedPkgId, setSelectedPkgId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [installDate, setInstallDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/packages").then((r) => r.json()),
      fetch("/api/compensation/me").then((r) => r.json()),
    ]).then(([pkgData, compData]) => {
      const pkgs: Package[] = pkgData.data ?? [];
      setPackages(pkgs);
      if (pkgs.length) setSelectedPkgId(pkgs[0].id);
      setMyTier(compData.tier ?? null);
    });
  }, []);

  const selectedPkg = packages.find((p) => p.id === selectedPkgId) ?? null;
  const commission = selectedPkg && myTier
    ? (myTier.commission_pct / 100) * selectedPkg.payout_amount
    : null;

  async function handleSubmit() {
    if (!customerName.trim()) { setError("Customer name is required"); return; }
    if (!selectedPkgId) { setError("Select a package"); return; }
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "sale_submitted",
          summary: `Sale: ${selectedPkg?.name ?? "Package"} — ${customerName}`,
          lead_id: leadId,
          metadata: {
            package_id: selectedPkgId,
            package_name: selectedPkg?.name,
            package_category: selectedPkg?.category,
            payout_amount: selectedPkg?.payout_amount,
            chargeback_days: selectedPkg?.chargeback_days ?? 90,
            commission_pct: myTier?.commission_pct ?? null,
            commission_amount: commission,
            tier_name: myTier?.name ?? null,
            customer_name: customerName.trim(),
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

        {/* Package picker — grouped by category */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Package sold <span className="text-red-500">*</span></label>
          {(["new", "migration", "mobility", "insurance"] as const).map((cat) => {
            const group = packages.filter((p) => p.category === cat);
            if (!group.length) return null;
            const labels: Record<string, string> = {
              new: "Internet — New Install",
              migration: "Internet — Copper to Fiber",
              mobility: "Mobile — New Line",
              insurance: "Mobile Insurance",
            };
            return (
              <div key={cat} className="mt-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{labels[cat]}</p>
                <div className="flex flex-col gap-1.5">
                  {group.map((pkg) => {
                    const tierCommission = myTier ? (myTier.commission_pct / 100) * pkg.payout_amount : null;
                    const selected = selectedPkgId === pkg.id;
                    return (
                      <button
                        key={pkg.id}
                        onClick={() => setSelectedPkgId(pkg.id)}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                          selected ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div>
                          <p className={`text-sm font-medium ${selected ? "text-blue-900" : "text-gray-800"}`}>{pkg.name}</p>
                          <p className="text-xs text-gray-400">
                            {pkg.speed_mbps ? (pkg.speed_mbps >= 1000 ? `${pkg.speed_mbps / 1000}Gbps` : `${pkg.speed_mbps}Mbps`) : ""}
                            {pkg.speed_mbps ? " · " : ""}
                            {pkg.chargeback_days}d liability
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${selected ? "text-blue-700" : "text-gray-700"}`}>
                            ${pkg.payout_amount}
                          </p>
                          {tierCommission !== null && (
                            <p className="text-xs text-green-600 font-medium">
                              Your cut: ${tierCommission.toFixed(0)}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Commission summary */}
        {commission !== null && myTier && selectedPkg && (
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-green-700">{myTier.name} · {myTier.commission_pct}% commission</p>
              <p className="text-sm font-semibold text-green-800">
                You earn ${commission.toFixed(2)} on this sale
              </p>
            </div>
            <div className="text-right text-xs text-green-600">
              <p>Payout: ${selectedPkg.payout_amount}</p>
            </div>
          </div>
        )}

        {!myTier && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            No commission tier assigned — contact your manager.
          </p>
        )}

        {/* Customer details */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Customer name <span className="text-red-500">*</span></label>
          <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
            placeholder="John Smith"
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Requested install date <span className="text-gray-400 font-normal">(optional)</span></label>
          <input type="date" value={installDate} onChange={(e) => setInstallDate(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder="Any special instructions, objections handled, etc."
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none" />
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Skip</Button>
          <Button loading={saving} onClick={handleSubmit}>Log Sale</Button>
        </div>
      </div>
    </Modal>
  );
}
