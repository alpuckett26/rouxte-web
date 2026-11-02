"use client";

import { useMemo, useState } from "react";
import {
  APPLIANCES,
  FUEL_LABELS,
  OUTAGE_OPTIONS,
  sizeBackup,
  type Appliance,
  type ApplianceId,
  type Fuel,
  type Recommendation,
} from "@/lib/quoting/backup-sizing";

const GROUPS: { id: Appliance["group"]; label: string }[] = [
  { id: "essentials", label: "Essentials" },
  { id: "comfort",    label: "Comfort" },
  { id: "heavy",      label: "Heavy loads" },
];

const REC_LABELS: Record<Recommendation, string> = {
  generator: "Standby generator",
  powerwall: "Powerwall battery",
  hybrid:    "Battery + generator",
};

const STARTER: Partial<Record<ApplianceId, number>> = { fridge: 1, lights: 1, electronics: 1 };

export default function BackupSizingCalculator() {
  const [loads, setLoads] = useState<Partial<Record<ApplianceId, number>>>(STARTER);
  const [fuel, setFuel] = useState<Fuel>("natural_gas");
  const [outageHours, setOutageHours] = useState<number>(24);
  const [solarKw, setSolarKw] = useState("");

  const result = useMemo(
    () => sizeBackup({ loads, fuel, outageHours, solarKw: Number(solarKw) || 0 }),
    [loads, fuel, outageHours, solarKw],
  );

  const setQty = (id: ApplianceId, qty: number) =>
    setLoads((prev) => ({ ...prev, [id]: Math.max(0, Math.min(9, qty)) }));

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-colors ${
      active ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
    }`;

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Backup Power Sizing</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ballpark a Powerwall or Briggs &amp; Stratton standby system at the door. The installer&apos;s survey sets the final size.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-800">Longest outage to cover</p>
              <div className="flex flex-wrap gap-2">
                {OUTAGE_OPTIONS.map((o) => (
                  <button key={o.hours} onClick={() => setOutageHours(o.hours)} className={chip(outageHours === o.hours)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-800">Fuel at the home</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(FUEL_LABELS) as Fuel[]).map((f) => (
                  <button key={f} onClick={() => setFuel(f)} className={chip(fuel === f)}>
                    {FUEL_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-gray-800">Rooftop solar (kW, 0 if none)</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.5}
                value={solarKw}
                onChange={(e) => setSolarKw(e.target.value)}
                placeholder="0"
                className="w-32 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          {GROUPS.map((g) => (
            <div key={g.id} className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-2">
              <p className="text-sm font-semibold text-gray-800">{g.label}</p>
              {APPLIANCES.filter((a) => a.group === g.id).map((a) => {
                const qty = loads[a.id] ?? 0;
                return (
                  <div key={a.id} className="flex items-center justify-between gap-3 py-1">
                    <div className="min-w-0">
                      <p className={`text-sm ${qty ? "font-semibold text-gray-900" : "text-gray-700"}`}>{a.label}</p>
                      <p className="text-xs text-gray-400">
                        {(a.runningW / 1000).toFixed(1)} kW{a.startingW ? ` · ${(a.startingW / 1000).toFixed(1)} kW start` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setQty(a.id, qty - 1)}
                        disabled={!qty}
                        aria-label={`Remove ${a.label}`}
                        className="h-8 w-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30">
                        −
                      </button>
                      <span className="w-5 text-center text-sm font-semibold text-gray-900">{qty}</span>
                      <button
                        onClick={() => setQty(a.id, qty + 1)}
                        aria-label={`Add ${a.label}`}
                        className="h-8 w-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-4 self-start w-full">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Recommended direction</p>
            <p className="text-lg font-bold text-blue-800 mt-1">{REC_LABELS[result.recommendation]}</p>
            <ul className="mt-2 space-y-1">
              {result.reasons.map((r) => (
                <li key={r} className="text-xs text-blue-700">{r}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 grid grid-cols-2 gap-3">
            <Stat label="Running load" value={`${result.runningKw} kW`} />
            <Stat label="Motor start" value={`${result.startingKw} kW`} />
            <Stat label="Energy / day" value={`${result.dailyKwh} kWh`} />
            <Stat label="Whole outage" value={`${result.outageKwh} kWh`} />
          </div>

          {result.generator && (
            <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
              <p className="text-sm font-semibold text-gray-800">Generator</p>
              <p className="text-base font-bold text-gray-900 mt-1">{result.generator.model}</p>
              <p className="text-xs text-gray-400">
                {result.generator.ratedKw} kW on {fuel === "natural_gas" ? "natural gas" : "propane"}
                {fuel === "none" ? " (tank needed)" : ""}
                {!result.generator.fits ? " · needs load management" : ""}
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
            <p className="text-sm font-semibold text-gray-800">Powerwall 3</p>
            <p className="text-base font-bold text-gray-900 mt-1">
              {result.powerwall.batteries} {result.powerwall.batteries === 1 ? "battery" : "batteries"}
              <span className="text-gray-400 font-normal"> · {(result.powerwall.batteries * 13.5).toFixed(1)} kWh</span>
            </p>
            <p className="text-xs text-gray-400">
              {result.powerwall.powerwall3Units} Powerwall 3
              {result.powerwall.batteries > result.powerwall.powerwall3Units
                ? ` + ${result.powerwall.batteries - result.powerwall.powerwall3Units} expansion`
                : ""}
              {!result.powerwall.fits ? " · beyond a single system" : ""}
            </p>
          </div>

          <p className="text-xs text-gray-400">
            Assumes everything selected runs at once. Rules-of-thumb loads; not a quote or a load calculation.
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-bold text-gray-900">{value}</p>
    </div>
  );
}
