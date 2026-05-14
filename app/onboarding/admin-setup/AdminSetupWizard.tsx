"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

/* ════════════════════════════════════════════════════════════════════════ */
/*  Autosave — survives reload, tab close, and power loss                   */
/* ════════════════════════════════════════════════════════════════════════ */

const DRAFT_KEY_SHAPE = "rouxte-wizard-shape-v1";
const DRAFT_KEY_SOLO  = "rouxte-wizard-solo-v1";
const DRAFT_KEY_TEAM  = "rouxte-wizard-team-v1";

function readDraft<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
}

function writeDraft(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function clearAllDrafts(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY_SHAPE);
    window.localStorage.removeItem(DRAFT_KEY_SOLO);
    window.localStorage.removeItem(DRAFT_KEY_TEAM);
  } catch {}
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  Types                                                                   */
/* ════════════════════════════════════════════════════════════════════════ */

type Shape = "solo" | "team" | null;
type Niche = "fiber" | "wireless" | "both";
type Role = "admin" | "sales_manager" | "team_lead" | "sales_rep";

type TeamStep = "org" | "team" | "comp" | "territory" | "done";
const TEAM_STEPS: TeamStep[] = ["org", "team", "comp", "territory", "done"];
const TEAM_LABELS: Record<TeamStep, string> = {
  org:       "Your org",
  team:      "Your team",
  comp:      "Pay rates",
  territory: "Territory",
  done:      "Done",
};

const CARRIERS: Array<{ key: string; label: string; niche: Niche[] }> = [
  { key: "att",          label: "AT&T Fiber",             niche: ["fiber", "both"] },
  { key: "frontier",     label: "Frontier Fiber",         niche: ["fiber", "both"] },
  { key: "spectrum",     label: "Spectrum",               niche: ["fiber", "both"] },
  { key: "verizon_fios", label: "Verizon Fios",           niche: ["fiber", "both"] },
  { key: "verizon_5g",   label: "Verizon 5G Home",        niche: ["wireless", "both"] },
  { key: "tmobile",      label: "T-Mobile Home Internet", niche: ["wireless", "both"] },
  { key: "starlink",     label: "Starlink",               niche: ["wireless", "both"] },
  { key: "directv",      label: "DIRECTV",                niche: ["wireless", "both"] },
];

const BRAND_COLORS = [
  { name: "Blue",   value: "#2563eb" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Green",  value: "#16a34a" },
  { name: "Amber",  value: "#d97706" },
  { name: "Red",    value: "#dc2626" },
  { name: "Pink",   value: "#db2777" },
  { name: "Slate",  value: "#475569" },
  { name: "Black",  value: "#111827" },
];

interface Member {
  email: string;
  full_name: string;
  role: Role;
}

interface CompRow {
  carrier: string;
  product: string;
  rep_payout_cents: number;
  manager_override_cents: number;
  lead_override_cents: number;
}

interface TeamForm {
  orgName: string;
  niche: Niche | "";
  carriers: string[];
  brandColor: string;
  counts: { sales_manager: number; team_lead: number; sales_rep: number };
  members: Member[];
  compRows: CompRow[];
  territoryZips: string;
}

const EMPTY_COMP: CompRow = {
  carrier: "",
  product: "",
  rep_payout_cents: 0,
  manager_override_cents: 0,
  lead_override_cents: 0,
};

/* ════════════════════════════════════════════════════════════════════════ */
/*  Root                                                                    */
/* ════════════════════════════════════════════════════════════════════════ */

export default function AdminSetupWizard() {
  const router = useRouter();
  const [shape, setShape] = useState<Shape>(() => readDraft<Shape>(DRAFT_KEY_SHAPE, null));

  useEffect(() => { writeDraft(DRAFT_KEY_SHAPE, shape); }, [shape]);

  function goBackToShape() {
    setShape(null);
  }
  function finishAll(path: string) {
    clearAllDrafts();
    router.push(path);
  }

  if (shape === null) return <ShapePicker onPick={setShape} />;
  if (shape === "solo") return <SoloSetup onDone={() => finishAll("/dashboard")} onBack={goBackToShape} />;
  return <TeamWizard onDone={() => finishAll("/getting-started?welcome=1")} onBack={goBackToShape} />;
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  Step 0 — Shape picker                                                   */
/* ════════════════════════════════════════════════════════════════════════ */

function ShapePicker({ onPick }: { onPick: (s: Shape) => void }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">How will you be using Rouxte?</h1>
        <p className="mt-3 text-gray-600 max-w-md mx-auto">
          We'll set up the right amount of structure for how you sell.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <button
          onClick={() => onPick("solo")}
          className="group text-left rounded-2xl border-2 border-gray-200 bg-white p-6 hover:border-blue-500 hover:shadow-md transition"
        >
          <div className="text-3xl">🚪</div>
          <div className="mt-3 font-bold text-lg text-gray-900">Just me, solo</div>
          <div className="mt-1 text-sm text-gray-600">
            One rep, your own commission, no team. We'll have you knocking in under a minute.
          </div>
          <div className="mt-4 text-sm font-semibold text-blue-600 group-hover:underline">Start solo →</div>
        </button>

        <button
          onClick={() => onPick("team")}
          className="group text-left rounded-2xl border-2 border-gray-200 bg-white p-6 hover:border-blue-500 hover:shadow-md transition"
        >
          <div className="text-3xl">🏢</div>
          <div className="mt-3 font-bold text-lg text-gray-900">I have a team</div>
          <div className="mt-1 text-sm text-gray-600">
            Reps, managers, comp plans, territories — full org setup. About 3 minutes.
          </div>
          <div className="mt-4 text-sm font-semibold text-blue-600 group-hover:underline">Set up my team →</div>
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  Solo path — single screen                                               */
/* ════════════════════════════════════════════════════════════════════════ */

function SoloSetup({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [perSale, setPerSale] = useState<string>(() => readDraft<string>(DRAFT_KEY_SOLO, ""));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { writeDraft(DRAFT_KEY_SOLO, perSale); }, [perSale]);

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      const dollars = parseFloat(perSale);
      const cents = isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : 0;
      const res = await fetch("/api/onboarding/admin-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shape: "solo", solo_comp_per_sale_cents: cents }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Save failed (${res.status})`);
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 mb-6">
        ← I actually have a team
      </button>

      <div className="text-center mb-8">
        <div className="text-4xl">💰</div>
        <h1 className="mt-4 text-3xl font-bold text-gray-900">One quick question.</h1>
        <p className="mt-3 text-gray-600">
          What do you make per sale, on average? We'll use this to track your earnings.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <label className="block">
          <span className="block text-xs font-semibold tracking-wide text-gray-600 uppercase mb-2">
            Average commission per sale
          </span>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400">$</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={perSale}
              onChange={(e) => setPerSale(e.target.value)}
              placeholder="75.00"
              className="w-full rounded-xl border-2 border-gray-200 pl-10 pr-4 py-4 text-2xl font-bold text-gray-900 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            You can change this later in Settings. Skip if you'd rather set it up after your first sale.
          </p>
        </label>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={save} loading={submitting}>Skip</Button>
          <Button className="flex-1" onClick={save} loading={submitting}>Save and start →</Button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  Team path — multi-step                                                  */
/* ════════════════════════════════════════════════════════════════════════ */

interface TeamDraft { form: TeamForm; stepIdx: number }

const TEAM_DEFAULT: TeamForm = {
  orgName:    "",
  niche:      "",
  carriers:   [],
  brandColor: "#2563eb",
  counts:     { sales_manager: 0, team_lead: 0, sales_rep: 0 },
  members:    [],
  compRows:   [{ ...EMPTY_COMP }],
  territoryZips: "",
};

function TeamWizard({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const initial = readDraft<TeamDraft | null>(DRAFT_KEY_TEAM, null);
  const [stepIdx, setStepIdx] = useState<number>(initial?.stepIdx ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<TeamForm>(initial?.form ?? TEAM_DEFAULT);

  useEffect(() => { writeDraft(DRAFT_KEY_TEAM, { form, stepIdx }); }, [form, stepIdx]);

  const step = TEAM_STEPS[stepIdx];
  const progress = Math.round((stepIdx / (TEAM_STEPS.length - 1)) * 100);

  const availableCarriers = useMemo(() => {
    if (!form.niche) return CARRIERS;
    return CARRIERS.filter((c) => c.niche.includes(form.niche as Niche));
  }, [form.niche]);

  function go(delta: number) {
    setError(null);
    setStepIdx((i) => Math.max(0, Math.min(TEAM_STEPS.length - 1, i + delta)));
  }

  // When counts change, sync the members[] length so each slot has a row
  function syncMembersToCounts(counts: TeamForm["counts"]) {
    const target: Member[] = [
      ...Array(counts.sales_manager).fill(0).map(() => ({ email: "", full_name: "", role: "sales_manager" as Role })),
      ...Array(counts.team_lead).fill(0).map(() => ({ email: "", full_name: "", role: "team_lead" as Role })),
      ...Array(counts.sales_rep).fill(0).map(() => ({ email: "", full_name: "", role: "sales_rep" as Role })),
    ];
    // Preserve any emails already typed by matching same-role slots in order
    const byRole: Record<Role, Member[]> = { admin: [], sales_manager: [], team_lead: [], sales_rep: [] };
    for (const m of form.members) byRole[m.role].push(m);
    for (let i = 0; i < target.length; i++) {
      const existing = byRole[target[i].role].shift();
      if (existing) target[i] = existing;
    }
    setForm((f) => ({ ...f, counts, members: target }));
  }

  async function finish() {
    setSubmitting(true);
    setError(null);
    try {
      const members = form.members
        .filter((m) => m.email.trim().length > 0)
        .map((m) => ({ email: m.email.trim().toLowerCase(), full_name: m.full_name.trim() || undefined, role: m.role }));

      const compPlans = form.compRows
        .filter((r) => r.carrier && r.product && r.rep_payout_cents > 0)
        .map((r) => ({
          carrier: r.carrier,
          product: r.product,
          rep_payout_cents: r.rep_payout_cents,
          manager_override_cents: r.manager_override_cents,
          lead_override_cents: r.lead_override_cents,
        }));

      const res = await fetch("/api/onboarding/admin-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shape: "team",
          org_name:         form.orgName || undefined,
          niche:            form.niche || undefined,
          primary_carriers: form.carriers,
          brand_color:      form.brandColor,
          members,
          comp_plans:       compPlans,
          territory_zips:   form.territoryZips.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Save failed (${res.status})`);
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save setup");
      setSubmitting(false);
    }
  }

  const canAdvance = (() => {
    switch (step) {
      case "org":       return form.orgName.trim().length > 0 && form.niche !== "";
      case "team":      return true;
      case "comp":      return true;
      case "territory": return true;
      case "done":      return true;
      default:          return true;
    }
  })();

  return (
    <div className="max-w-3xl mx-auto">
      <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 mb-4">
        ← I'm actually solo
      </button>

      {/* Progress rail */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
            Step {stepIdx + 1} of {TEAM_STEPS.length} · {TEAM_LABELS[step]}
          </div>
          <div className="text-xs text-gray-500">{progress}% complete</div>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
            style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Step card */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="p-6 sm:p-10">
          {step === "org"       && <OrgStep form={form} setForm={setForm} availableCarriers={availableCarriers} />}
          {step === "team"      && <TeamStep form={form} setForm={setForm} syncCounts={syncMembersToCounts} />}
          {step === "comp"      && <CompStep form={form} setForm={setForm} />}
          {step === "territory" && <TerritoryStep form={form} setForm={setForm} />}
          {step === "done"      && <DoneStep form={form} />}
        </div>

        {error && (
          <div className="mx-6 sm:mx-10 mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="px-6 sm:px-10 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
          <button type="button" onClick={() => go(-1)} disabled={stepIdx === 0}
            className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-2">
            ← Back
          </button>

          {step !== "done" ? (
            <div className="flex items-center gap-3">
              {(step === "team" || step === "comp" || step === "territory") && (
                <button type="button" onClick={() => go(1)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">
                  Skip for now
                </button>
              )}
              <Button onClick={() => go(1)} disabled={!canAdvance}>Continue →</Button>
            </div>
          ) : (
            <Button onClick={finish} loading={submitting} size="lg">Save and take the tour →</Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  Team steps                                                              */
/* ════════════════════════════════════════════════════════════════════════ */

function OrgStep({
  form, setForm, availableCarriers,
}: {
  form: TeamForm;
  setForm: (u: (f: TeamForm) => TeamForm) => void;
  availableCarriers: Array<{ key: string; label: string }>;
}) {
  function toggleCarrier(key: string) {
    setForm((f) => ({
      ...f,
      carriers: f.carriers.includes(key) ? f.carriers.filter((k) => k !== key) : [...f.carriers, key],
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Tell us about your org</h2>
        <p className="mt-1 text-sm text-gray-500">This filters your map overlays and what Rex coaches your reps on.</p>
      </div>

      <label className="block">
        <span className="block text-xs font-semibold tracking-wide text-gray-600 uppercase mb-1.5">Org name</span>
        <input type="text" value={form.orgName} onChange={(e) => setForm((f) => ({ ...f, orgName: e.target.value }))}
          placeholder="Lectricash Door-to-Door"
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </label>

      <div>
        <span className="block text-xs font-semibold tracking-wide text-gray-600 uppercase mb-1.5">What do you sell?</span>
        <div className="grid grid-cols-3 gap-2">
          {(["fiber", "wireless", "both"] as Niche[]).map((n) => (
            <button key={n} type="button" onClick={() => setForm((f) => ({ ...f, niche: n, carriers: [] }))}
              className={[
                "rounded-xl border-2 py-3 text-sm font-semibold capitalize transition",
                form.niche === n ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300",
              ].join(" ")}>
              {n === "both" ? "Both" : n}
            </button>
          ))}
        </div>
      </div>

      {form.niche && (
        <div>
          <span className="block text-xs font-semibold tracking-wide text-gray-600 uppercase mb-1.5">
            Carriers you sell
          </span>
          <div className="grid sm:grid-cols-2 gap-2">
            {availableCarriers.map((c) => {
              const on = form.carriers.includes(c.key);
              return (
                <button key={c.key} type="button" onClick={() => toggleCarrier(c.key)}
                  className={[
                    "text-left rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition",
                    on ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300 text-gray-700",
                  ].join(" ")}>
                  <span className="inline-flex items-center gap-2">
                    <span className={[
                      "w-4 h-4 rounded border flex items-center justify-center text-[10px] font-bold",
                      on ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300",
                    ].join(" ")}>{on ? "✓" : ""}</span>
                    {c.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <span className="block text-xs font-semibold tracking-wide text-gray-600 uppercase mb-1.5">Accent color</span>
        <div className="flex flex-wrap gap-2">
          {BRAND_COLORS.map((c) => (
            <button key={c.value} type="button" onClick={() => setForm((f) => ({ ...f, brandColor: c.value }))}
              className={[
                "h-9 w-9 rounded-full border-2 transition",
                form.brandColor === c.value ? "border-gray-900 scale-110" : "border-gray-200 hover:border-gray-400",
              ].join(" ")} style={{ backgroundColor: c.value }} title={c.name} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TeamStep({
  form, setForm, syncCounts,
}: {
  form: TeamForm;
  setForm: (u: (f: TeamForm) => TeamForm) => void;
  syncCounts: (c: TeamForm["counts"]) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Who's on your team?</h2>
        <p className="mt-1 text-sm text-gray-500">Tell us how many of each, then fill in their info. We'll email everyone an invite.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <CountField label="Sales Managers"
          value={form.counts.sales_manager}
          onChange={(v) => syncCounts({ ...form.counts, sales_manager: v })} />
        <CountField label="Team Leads"
          value={form.counts.team_lead}
          onChange={(v) => syncCounts({ ...form.counts, team_lead: v })} />
        <CountField label="Sales Reps"
          value={form.counts.sales_rep}
          onChange={(v) => syncCounts({ ...form.counts, sales_rep: v })} />
      </div>

      {form.members.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
            {form.members.length} member{form.members.length === 1 ? "" : "s"} to invite
          </div>
          {form.members.map((m, i) => (
            <MemberRow key={i} index={i} member={m}
              onChange={(updated) => setForm((f) => ({
                ...f,
                members: f.members.map((row, j) => (j === i ? updated : row)),
              }))}
              onRemove={() => setForm((f) => ({
                ...f,
                members: f.members.filter((_, j) => j !== i),
                counts: {
                  ...f.counts,
                  [m.role]: Math.max(0, (f.counts[m.role as "sales_manager" | "team_lead" | "sales_rep"] ?? 0) - 1),
                },
              }))}
            />
          ))}
        </div>
      )}

      {form.members.length === 0 && (
        <div className="rounded-xl bg-gray-50 border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
          Bump a count above to add team members. You can also skip this step and add people later.
        </div>
      )}
    </div>
  );
}

function CountField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3 bg-gray-50/50">
      <div className="text-[11px] font-semibold tracking-wide text-gray-600 uppercase mb-2">{label}</div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))}
          className="h-8 w-8 rounded-lg bg-white border border-gray-200 text-gray-700 font-bold hover:bg-gray-50">−</button>
        <div className="flex-1 text-center text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
        <button type="button" onClick={() => onChange(value + 1)}
          className="h-8 w-8 rounded-lg bg-white border border-gray-200 text-gray-700 font-bold hover:bg-gray-50">+</button>
      </div>
    </div>
  );
}

function MemberRow({
  index, member, onChange, onRemove,
}: {
  index: number;
  member: Member;
  onChange: (m: Member) => void;
  onRemove: () => void;
}) {
  const roleLabel: Record<Role, string> = {
    admin: "Admin", sales_manager: "Manager", team_lead: "Lead", sales_rep: "Rep",
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 grid grid-cols-1 sm:grid-cols-[100px_1fr_1fr_36px] gap-2 items-center">
      <div className="text-xs font-semibold text-gray-600">{roleLabel[member.role]} {index + 1}</div>
      <input type="text" placeholder="Full name" value={member.full_name}
        onChange={(e) => onChange({ ...member, full_name: e.target.value })}
        className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
      <input type="email" placeholder="email@team.com" value={member.email}
        onChange={(e) => onChange({ ...member, email: e.target.value })}
        className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
      <button type="button" onClick={onRemove} className="text-gray-400 hover:text-red-600 text-lg" title="Remove">×</button>
    </div>
  );
}

/* ─── Comp step (manual + AI parse) ───────────────────────────────────── */

function CompStep({
  form, setForm,
}: {
  form: TeamForm;
  setForm: (u: (f: TeamForm) => TeamForm) => void;
}) {
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [aiText, setAiText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  async function parseWithAI() {
    setParsing(true);
    setParseError(null);
    try {
      const res = await fetch("/api/ai/parse-comp-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiText }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Parse failed (${res.status})`);
      const rows: CompRow[] = Array.isArray(j.rows) ? j.rows : [];
      if (rows.length === 0) throw new Error("Couldn't find any commission rows. Try pasting more context.");
      setForm((f) => ({ ...f, compRows: rows }));
      setMode("manual"); // drop to manual so user can review/edit
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Set your team's pay rates</h2>
        <p className="mt-1 text-sm text-gray-500">Per-carrier, per-product commission. Used by the dashboard for projected earnings.</p>
      </div>

      <div className="inline-flex rounded-xl bg-gray-100 p-1">
        <button type="button" onClick={() => setMode("manual")}
          className={["px-4 py-2 text-sm font-semibold rounded-lg transition",
            mode === "manual" ? "bg-white shadow text-gray-900" : "text-gray-600"].join(" ")}>
          Enter manually
        </button>
        <button type="button" onClick={() => setMode("ai")}
          className={["px-4 py-2 text-sm font-semibold rounded-lg transition",
            mode === "ai" ? "bg-white shadow text-gray-900" : "text-gray-600"].join(" ")}>
          Paste from dealer ✨
        </button>
      </div>

      {mode === "manual" ? (
        <div className="space-y-2">
          {form.compRows.map((row, i) => (
            <CompRowEditor key={i} row={row}
              onChange={(updated) => setForm((f) => ({
                ...f,
                compRows: f.compRows.map((r, j) => (j === i ? updated : r)),
              }))}
              onRemove={() => setForm((f) => ({
                ...f,
                compRows: f.compRows.length === 1 ? [{ ...EMPTY_COMP }] : f.compRows.filter((_, j) => j !== i),
              }))}
            />
          ))}
          <button type="button" onClick={() => setForm((f) => ({ ...f, compRows: [...f.compRows, { ...EMPTY_COMP }] }))}
            className="w-full rounded-xl border-2 border-dashed border-gray-300 px-4 py-3 text-sm font-semibold text-gray-600 hover:border-blue-500 hover:text-blue-600">
            + Add another product
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Paste your dealer's commission sheet below. We'll extract carrier, product, and per-sale payouts —
            you'll review before saving.
          </p>
          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            placeholder={`Example:\nAT&T Fiber 300/300 — Rep $75, Manager $15\nAT&T Fiber 1G — Rep $100, Manager $20\nT-Mobile Home Internet — Rep $50, Manager $10`}
            rows={10}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {parseError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{parseError}</div>
          )}
          <Button onClick={parseWithAI} loading={parsing} disabled={aiText.trim().length < 20}>
            Parse with AI →
          </Button>
        </div>
      )}
    </div>
  );
}

function CompRowEditor({
  row, onChange, onRemove,
}: {
  row: CompRow;
  onChange: (r: CompRow) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 grid grid-cols-1 sm:grid-cols-[1fr_1fr_90px_90px_90px_36px] gap-2 items-center">
      <input type="text" placeholder="Carrier (e.g. AT&T Fiber)" value={row.carrier}
        onChange={(e) => onChange({ ...row, carrier: e.target.value })}
        className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
      <input type="text" placeholder="Product (e.g. 1Gig)" value={row.product}
        onChange={(e) => onChange({ ...row, product: e.target.value })}
        className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
      <DollarField label="Rep" cents={row.rep_payout_cents}
        onChange={(c) => onChange({ ...row, rep_payout_cents: c })} />
      <DollarField label="Mgr" cents={row.manager_override_cents}
        onChange={(c) => onChange({ ...row, manager_override_cents: c })} />
      <DollarField label="Lead" cents={row.lead_override_cents}
        onChange={(c) => onChange({ ...row, lead_override_cents: c })} />
      <button type="button" onClick={onRemove} className="text-gray-400 hover:text-red-600 text-lg" title="Remove">×</button>
    </div>
  );
}

function DollarField({ label, cents, onChange }: { label: string; cents: number; onChange: (c: number) => void }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold tracking-wide text-gray-500 uppercase">{label}</span>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
        <input type="number" min="0" step="0.01" value={cents === 0 ? "" : (cents / 100).toFixed(2)}
          onChange={(e) => onChange(Math.max(0, Math.round((parseFloat(e.target.value) || 0) * 100)))}
          placeholder="0"
          className="w-full rounded-lg border border-gray-200 pl-5 pr-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </div>
    </label>
  );
}

function TerritoryStep({
  form, setForm,
}: {
  form: TeamForm;
  setForm: (u: (f: TeamForm) => TeamForm) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Where are you knocking?</h2>
        <p className="mt-1 text-sm text-gray-500">ZIP codes — we'll pre-fetch FCC fiber coverage for these.</p>
      </div>
      <textarea
        value={form.territoryZips}
        onChange={(e) => setForm((f) => ({ ...f, territoryZips: e.target.value }))}
        placeholder="78704, 78745, 78748"
        rows={4}
        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <p className="text-xs text-gray-500">Separate ZIPs with commas, spaces, or new lines.</p>
    </div>
  );
}

function DoneStep({ form }: { form: TeamForm }) {
  const inviteCount = form.members.filter((m) => m.email.trim().length > 0).length;
  const compRowCount = form.compRows.filter((r) => r.carrier && r.product && r.rep_payout_cents > 0).length;
  const zipCount = form.territoryZips.split(/[\s,;]+/).filter((s) => s.trim().length > 0).length;

  return (
    <div className="text-center space-y-6">
      <div className="mx-auto w-16 h-16 rounded-full bg-lime-100 text-lime-700 flex items-center justify-center text-3xl">✓</div>
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Ready to knock.</h2>
        <p className="mt-2 text-gray-600">Here's what we'll do when you save:</p>
      </div>
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-5 text-left space-y-2 text-sm max-w-md mx-auto">
        <Bullet on={form.orgName.length > 0}>Set up <strong>{form.orgName || "your org"}</strong> as a {form.niche || "telecom"} dealership</Bullet>
        <Bullet on={inviteCount > 0}>Email {inviteCount} team invite{inviteCount === 1 ? "" : "s"}</Bullet>
        <Bullet on={compRowCount > 0}>Save {compRowCount} commission row{compRowCount === 1 ? "" : "s"}</Bullet>
        <Bullet on={zipCount > 0}>Pre-fetch coverage for {zipCount} ZIP{zipCount === 1 ? "" : "s"}</Bullet>
      </div>
    </div>
  );
}

function Bullet({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <div className={["flex items-start gap-2", on ? "text-gray-900" : "text-gray-400"].join(" ")}>
      <span className={on ? "text-lime-600" : "text-gray-300"}>{on ? "✓" : "—"}</span>
      <span>{children}</span>
    </div>
  );
}
