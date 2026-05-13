"use client";

import { useEffect, useState, useCallback } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";

interface Package { id: string; name: string; speed_mbps: number | null; payout_amount: number; active: boolean; display_order: number }
interface Tier { id: string; name: string; commission_pct: number; display_order: number }

export default function CompensationPanel() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loadingPkg, setLoadingPkg] = useState(true);
  const [loadingTiers, setLoadingTiers] = useState(true);

  // Package create modal
  const [pkgModalOpen, setPkgModalOpen] = useState(false);
  const [pkgName, setPkgName] = useState("");
  const [pkgSpeed, setPkgSpeed] = useState("");
  const [pkgPayout, setPkgPayout] = useState("");
  const [pkgSaving, setPkgSaving] = useState(false);
  const [pkgError, setPkgError] = useState("");

  // Tier editing (inline)
  const [tierEdits, setTierEdits] = useState<Record<string, string>>({});
  const [tierSaving, setTierSaving] = useState(false);

  // Override rates (org-wide) — team_lead and sales_manager get a % of every
  // sale made by reps under their team. Editing requires admin role.
  const [teamLeadPct, setTeamLeadPct] = useState("");
  const [managerPct,  setManagerPct]  = useState("");
  const [overrideLoading, setOverrideLoading] = useState(true);
  const [overrideSaving,  setOverrideSaving]  = useState(false);
  const [overrideError,   setOverrideError]   = useState("");

  const fetchPackages = useCallback(async () => {
    const res = await fetch("/api/packages");
    const d = await res.json();
    setPackages(d.data ?? []);
    setLoadingPkg(false);
  }, []);

  const fetchTiers = useCallback(async () => {
    const res = await fetch("/api/sales-tiers");
    const d = await res.json();
    const fetched: Tier[] = d.data ?? [];
    setTiers(fetched);
    const edits: Record<string, string> = {};
    fetched.forEach((t) => { edits[t.id] = String(t.commission_pct); });
    setTierEdits(edits);
    setLoadingTiers(false);
  }, []);

  const fetchOverrides = useCallback(async () => {
    const res = await fetch("/api/org/settings");
    if (res.ok) {
      const d = await res.json();
      setTeamLeadPct(String(d.data?.team_lead_override_pct ?? "0"));
      setManagerPct(String(d.data?.manager_override_pct ?? "0"));
    }
    setOverrideLoading(false);
  }, []);

  async function saveOverrides() {
    setOverrideError(""); setOverrideSaving(true);
    const res = await fetch("/api/org/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_lead_override_pct: parseFloat(teamLeadPct || "0"),
        manager_override_pct:   parseFloat(managerPct  || "0"),
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setOverrideError(d.error ?? `Save failed (${res.status})`);
    }
    setOverrideSaving(false);
  }

  useEffect(() => { fetchPackages(); fetchTiers(); fetchOverrides(); }, [fetchPackages, fetchTiers, fetchOverrides]);

  async function createPackage() {
    if (!pkgName.trim() || !pkgPayout) { setPkgError("Name and payout are required"); return; }
    setPkgError(""); setPkgSaving(true);
    const res = await fetch("/api/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: pkgName.trim(), speed_mbps: pkgSpeed ? parseInt(pkgSpeed) : null, payout_amount: parseFloat(pkgPayout) }),
    });
    if (res.ok) { setPkgModalOpen(false); setPkgName(""); setPkgSpeed(""); setPkgPayout(""); fetchPackages(); }
    else { const d = await res.json(); setPkgError(d.error ?? "Failed"); }
    setPkgSaving(false);
  }

  async function togglePackage(pkg: Package) {
    await fetch(`/api/packages/${pkg.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !pkg.active }),
    });
    fetchPackages();
  }

  async function saveTiers() {
    setTierSaving(true);
    await fetch("/api/sales-tiers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tiers: tiers.map((t) => ({ id: t.id, commission_pct: parseFloat(tierEdits[t.id] ?? "0") })),
      }),
    });
    fetchTiers();
    setTierSaving(false);
  }

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Compensation</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure packages and commission tiers</p>
      </div>

      {/* ── Commission Tiers ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Commission Tiers</h2>
            <p className="text-xs text-gray-500">Percentage of package payout earned per sale</p>
          </div>
        </div>
        {loadingTiers ? (
          <div className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
        ) : (
          <Card padding="md">
            <div className="flex flex-col gap-4">
              {tiers.map((tier) => {
                const pct = parseFloat(tierEdits[tier.id] ?? "0");
                return (
                  <div key={tier.id} className="flex items-center gap-4">
                    <div className="w-20 shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{tier.name}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={tierEdits[tier.id] ?? ""}
                        onChange={(e) => setTierEdits((prev) => ({ ...prev, [tier.id]: e.target.value }))}
                        className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                      <span className="text-sm text-gray-500">% of payout</span>
                      <div className="flex gap-3 ml-4 text-xs text-gray-400">
                        {[500, 450, 350].map((amt) => (
                          <span key={amt}>${amt} → <span className="font-medium text-gray-700">${((pct / 100) * amt).toFixed(0)}</span></span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-gray-100 flex justify-end">
                <Button size="sm" loading={tierSaving} onClick={saveTiers}>Save Tiers</Button>
              </div>
            </div>
          </Card>
        )}
      </section>

      {/* ── Override Commission ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Override Commission</h2>
            <p className="text-xs text-gray-500">
              % of payout earned by team leads + sales managers on team sales. Paid on top of the rep's commission, every period.
            </p>
          </div>
        </div>
        {overrideLoading ? (
          <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
        ) : (
          <Card padding="md">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="w-32 shrink-0">
                  <p className="text-sm font-semibold text-gray-900">Team Lead</p>
                  <p className="text-xs text-gray-500">Per team sale</p>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="number" min={0} max={100} step={0.25}
                    value={teamLeadPct}
                    onChange={(e) => setTeamLeadPct(e.target.value)}
                    className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <span className="text-sm text-gray-500">% of payout</span>
                  <div className="flex gap-3 ml-4 text-xs text-gray-400">
                    {[500, 350, 200].map((amt) => (
                      <span key={amt}>${amt} → <span className="font-medium text-gray-700">${((parseFloat(teamLeadPct || "0") / 100) * amt).toFixed(2)}</span></span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-32 shrink-0">
                  <p className="text-sm font-semibold text-gray-900">Sales Manager</p>
                  <p className="text-xs text-gray-500">Per sale on assigned teams</p>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="number" min={0} max={100} step={0.25}
                    value={managerPct}
                    onChange={(e) => setManagerPct(e.target.value)}
                    className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <span className="text-sm text-gray-500">% of payout</span>
                  <div className="flex gap-3 ml-4 text-xs text-gray-400">
                    {[500, 350, 200].map((amt) => (
                      <span key={amt}>${amt} → <span className="font-medium text-gray-700">${((parseFloat(managerPct || "0") / 100) * amt).toFixed(2)}</span></span>
                    ))}
                  </div>
                </div>
              </div>
              {overrideError && <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{overrideError}</p>}
              <p className="text-xs text-gray-500 -mb-1">
                Sales managers earn override only on teams they're assigned to. Assign them via Manage → People → set role on a team.
              </p>
              <div className="pt-2 border-t border-gray-100 flex justify-end">
                <Button size="sm" loading={overrideSaving} onClick={saveOverrides}>Save Overrides</Button>
              </div>
            </div>
          </Card>
        )}
      </section>

      {/* ── Packages ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Packages</h2>
            <p className="text-xs text-gray-500">Products reps sell — payout is before commission</p>
          </div>
          <Button size="sm" onClick={() => setPkgModalOpen(true)}>Add Package</Button>
        </div>

        {loadingPkg ? (
          <div className="flex flex-col gap-2">
            {[1,2,3].map((i) => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Package</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Speed</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Payout</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">T1 / T2 / T3</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {packages.map((pkg) => {
                  const t = tiers;
                  return (
                    <tr key={pkg.id} className={pkg.active ? "" : "opacity-40"}>
                      <td className="px-4 py-3 font-medium text-gray-900">{pkg.name}</td>
                      <td className="px-4 py-3 text-gray-500">{pkg.speed_mbps ? `${pkg.speed_mbps} Mbps` : "—"}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">${pkg.payout_amount}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {t.map((tier) => (
                          <span key={tier.id} className="mr-2">
                            ${((tier.commission_pct / 100) * pkg.payout_amount).toFixed(0)}
                          </span>
                        ))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => togglePackage(pkg)}
                          className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          {pkg.active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={pkgModalOpen} onClose={() => setPkgModalOpen(false)} title="Add Package">
        <div className="flex flex-col gap-4">
          <Input label="Package name" value={pkgName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPkgName(e.target.value)} placeholder="e.g. 1 Gig Fiber" />
          <Input label="Speed (Mbps)" value={pkgSpeed} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPkgSpeed(e.target.value)} placeholder="1000" />
          <Input label="Payout amount ($)" value={pkgPayout} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPkgPayout(e.target.value)} placeholder="500" />
          {pkgError && <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{pkgError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPkgModalOpen(false)}>Cancel</Button>
            <Button loading={pkgSaving} onClick={createPackage}>Add</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
