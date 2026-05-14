"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

type Step = "welcome" | "org" | "branding" | "team" | "territory" | "done";
const STEPS: Step[] = ["welcome", "org", "branding", "team", "territory", "done"];
const STEP_LABELS: Record<Step, string> = {
  welcome:   "Welcome",
  org:       "Your org",
  branding:  "Branding",
  team:      "Invite team",
  territory: "Territory",
  done:      "Done",
};

type Niche = "fiber" | "wireless" | "both";
const CARRIERS: Array<{ key: string; label: string; niche: Niche[] }> = [
  { key: "att",        label: "AT&T Fiber",          niche: ["fiber", "both"] },
  { key: "frontier",   label: "Frontier Fiber",      niche: ["fiber", "both"] },
  { key: "spectrum",   label: "Spectrum",            niche: ["fiber", "both"] },
  { key: "verizon_fios", label: "Verizon Fios",      niche: ["fiber", "both"] },
  { key: "verizon_5g", label: "Verizon 5G Home",     niche: ["wireless", "both"] },
  { key: "tmobile",    label: "T-Mobile Home Internet", niche: ["wireless", "both"] },
  { key: "starlink",   label: "Starlink",            niche: ["wireless", "both"] },
  { key: "directv",    label: "DIRECTV",             niche: ["wireless", "both"] },
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

interface FormState {
  orgName:        string;
  niche:          Niche | "";
  carriers:       string[];
  brandColor:     string;
  logoFile:       File | null;
  inviteEmails:   string;
  inviteRole:     "sales_rep" | "team_lead" | "sales_manager";
  territoryZips:  string;
}

export default function AdminSetupWizard() {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    orgName:       "",
    niche:         "",
    carriers:      [],
    brandColor:    "#2563eb",
    logoFile:      null,
    inviteEmails:  "",
    inviteRole:    "sales_rep",
    territoryZips: "",
  });

  const step = STEPS[stepIdx];
  const progress = useMemo(() => Math.round((stepIdx / (STEPS.length - 1)) * 100), [stepIdx]);

  const availableCarriers = useMemo(() => {
    if (!form.niche) return CARRIERS;
    return CARRIERS.filter((c) => c.niche.includes(form.niche as Niche));
  }, [form.niche]);

  function go(delta: number) {
    setError(null);
    setStepIdx((i) => Math.max(0, Math.min(STEPS.length - 1, i + delta)));
  }

  function toggleCarrier(key: string) {
    setForm((f) => ({
      ...f,
      carriers: f.carriers.includes(key)
        ? f.carriers.filter((k) => k !== key)
        : [...f.carriers, key],
    }));
  }

  async function finish() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/admin-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_name:        form.orgName || undefined,
          niche:           form.niche || undefined,
          primary_carriers: form.carriers,
          brand_color:     form.brandColor,
          invite_emails:   form.inviteEmails
            .split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean),
          invite_role:     form.inviteRole,
          territory_zips:  form.territoryZips
            .split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Save failed (${res.status})`);
      }
      router.push("/getting-started?welcome=1");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save setup");
      setSubmitting(false);
    }
  }

  const canAdvance = (() => {
    switch (step) {
      case "welcome":   return true;
      case "org":       return form.orgName.trim().length > 0 && form.niche !== "";
      case "branding":  return true; // optional
      case "team":      return true; // optional
      case "territory": return true; // optional
      case "done":      return true;
      default: return true;
    }
  })();

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress rail */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
            Step {stepIdx + 1} of {STEPS.length} · {STEP_LABELS[step]}
          </div>
          <div className="text-xs text-gray-500">{progress}% complete</div>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-3 hidden sm:flex items-center justify-between text-xs">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={[
                "flex items-center gap-1.5",
                i === stepIdx ? "text-blue-700 font-semibold" : i < stepIdx ? "text-gray-700" : "text-gray-400",
              ].join(" ")}
            >
              <div className={[
                "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                i < stepIdx ? "bg-blue-600 text-white" : i === stepIdx ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400",
              ].join(" ")}>
                {i < stepIdx ? "✓" : i + 1}
              </div>
              <span>{STEP_LABELS[s]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step card */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="p-6 sm:p-10">
          {step === "welcome"   && <WelcomeStep />}
          {step === "org"       && <OrgStep form={form} setForm={setForm} availableCarriers={availableCarriers} toggleCarrier={toggleCarrier} />}
          {step === "branding"  && <BrandingStep form={form} setForm={setForm} />}
          {step === "team"      && <TeamStep form={form} setForm={setForm} />}
          {step === "territory" && <TerritoryStep form={form} setForm={setForm} />}
          {step === "done"      && <DoneStep form={form} />}
        </div>

        {error && (
          <div className="mx-6 sm:mx-10 mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="px-6 sm:px-10 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={stepIdx === 0}
            className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-2"
          >
            ← Back
          </button>

          {step !== "done" ? (
            <div className="flex items-center gap-3">
              {(step === "branding" || step === "team" || step === "territory") && (
                <button
                  type="button"
                  onClick={() => go(1)}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
                >
                  Skip for now
                </button>
              )}
              <Button onClick={() => go(1)} disabled={!canAdvance}>
                {step === "welcome" ? "Let's go" : "Continue"} →
              </Button>
            </div>
          ) : (
            <Button onClick={finish} loading={submitting} size="lg">
              Save and take the tour →
            </Button>
          )}
        </div>
      </div>

      <p className="text-center mt-6 text-xs text-gray-400">
        You can change any of this later in <span className="font-medium">Settings → Organization</span>.
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  Steps                                                                   */
/* ════════════════════════════════════════════════════════════════════════ */

function WelcomeStep() {
  return (
    <div className="text-center">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center text-3xl">
        👋
      </div>
      <h1 className="mt-6 text-3xl font-bold text-gray-900">Welcome to Rouxte.</h1>
      <p className="mt-3 text-gray-600 max-w-md mx-auto">
        Let's get your org set up so your team can hit the doors today.
        This takes about <span className="font-semibold">3 minutes</span> — and you can skip
        anything you'd rather come back to later.
      </p>
      <div className="mt-8 grid sm:grid-cols-3 gap-3 text-left">
        {[
          { icon: "🏢", title: "Your org",       blurb: "Name, niche, carriers you sell." },
          { icon: "🎨", title: "Branding",       blurb: "Logo + accent color (skippable)." },
          { icon: "👥", title: "Invite team",    blurb: "Bring your reps along (skippable)." },
        ].map((c) => (
          <div key={c.title} className="rounded-xl border border-gray-200 p-4 bg-gray-50/50">
            <div className="text-2xl">{c.icon}</div>
            <div className="mt-1 font-semibold text-gray-900 text-sm">{c.title}</div>
            <div className="text-xs text-gray-500 mt-0.5">{c.blurb}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CarrierType { key: string; label: string; niche: Niche[]; }

function OrgStep({
  form, setForm, availableCarriers, toggleCarrier,
}: {
  form: FormState;
  setForm: (f: FormState | ((f: FormState) => FormState)) => void;
  availableCarriers: CarrierType[];
  toggleCarrier: (key: string) => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Tell us about your org</h2>
      <p className="mt-1 text-gray-600">We'll use this to filter Coach knowledge, quote templates, and the carrier overlay on the map.</p>

      <div className="mt-6 space-y-5">
        <Field label="Organization name">
          <input
            type="text"
            value={form.orgName}
            onChange={(e) => setForm({ ...form, orgName: e.target.value })}
            placeholder="Acme Door Knockers, LLC"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Field>

        <Field label="What does your team sell?">
          <div className="grid grid-cols-3 gap-3">
            {(["fiber", "wireless", "both"] as Niche[]).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setForm({ ...form, niche: n, carriers: [] })}
                className={[
                  "rounded-xl border px-4 py-3 text-sm font-semibold capitalize transition",
                  form.niche === n
                    ? "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-100"
                    : "border-gray-200 text-gray-700 hover:border-gray-300",
                ].join(" ")}
              >
                {n === "fiber" ? "Fiber only" : n === "wireless" ? "Wireless only" : "Both"}
              </button>
            ))}
          </div>
        </Field>

        {form.niche && (
          <Field label="Which carriers do you sell?">
            <div className="grid sm:grid-cols-2 gap-2">
              {availableCarriers.map((c) => {
                const active = form.carriers.includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toggleCarrier(c.key)}
                    className={[
                      "rounded-xl border px-4 py-2.5 text-sm font-medium text-left transition flex items-center gap-2",
                      active
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-700 hover:border-gray-300",
                    ].join(" ")}
                  >
                    <span className={[
                      "w-4 h-4 rounded border flex items-center justify-center text-[10px] font-bold",
                      active ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300",
                    ].join(" ")}>{active ? "✓" : ""}</span>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </Field>
        )}
      </div>
    </div>
  );
}

function BrandingStep({
  form, setForm,
}: { form: FormState; setForm: (f: FormState) => void }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Add some branding</h2>
      <p className="mt-1 text-gray-600">Your logo and color appear in your reps' app, on customer-facing quotes, and on your SmartPitch funnel.</p>

      <div className="mt-6 space-y-6">
        <Field label="Accent color">
          <div className="flex gap-2 flex-wrap">
            {BRAND_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setForm({ ...form, brandColor: c.value })}
                className={[
                  "w-10 h-10 rounded-xl border-2 transition-transform flex items-center justify-center",
                  form.brandColor === c.value ? "border-gray-900 scale-110" : "border-transparent hover:scale-105",
                ].join(" ")}
                style={{ backgroundColor: c.value }}
                title={c.name}
              >
                {form.brandColor === c.value && <span className="text-white text-sm">✓</span>}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Logo (optional)">
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-6 text-center hover:border-gray-300 transition">
            <input
              type="file"
              id="logo-upload"
              accept="image/png,image/jpeg,image/svg+xml"
              onChange={(e) => setForm({ ...form, logoFile: e.target.files?.[0] ?? null })}
              className="hidden"
            />
            <label htmlFor="logo-upload" className="cursor-pointer">
              {form.logoFile ? (
                <div className="text-sm">
                  <div className="font-semibold text-gray-900">{form.logoFile.name}</div>
                  <div className="text-xs text-gray-500 mt-1">Click to replace</div>
                </div>
              ) : (
                <div>
                  <div className="text-3xl">📷</div>
                  <div className="mt-2 text-sm font-semibold text-gray-700">Drop a logo or click to browse</div>
                  <div className="text-xs text-gray-500 mt-1">PNG, JPG, or SVG · max 2 MB</div>
                </div>
              )}
            </label>
          </div>
        </Field>

        <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
          <div className="text-xs font-semibold tracking-wide uppercase text-gray-500 mb-2">Preview</div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: form.brandColor }}>
              {form.orgName.charAt(0).toUpperCase() || "R"}
            </div>
            <div>
              <div className="font-semibold text-gray-900">{form.orgName || "Your Org"}</div>
              <div className="text-xs text-gray-500">via Rouxte</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamStep({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  const emailCount = form.inviteEmails.split(/[\s,;]+/).filter((s) => /@/.test(s)).length;
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Invite your team</h2>
      <p className="mt-1 text-gray-600">Bring your reps along. They'll get an email invite with a one-click signup link.</p>

      <div className="mt-6 space-y-5">
        <Field label="Default role for invitees">
          <div className="grid sm:grid-cols-3 gap-2">
            {[
              { key: "sales_rep",     label: "Sales Rep",     blurb: "Knock + log + quote" },
              { key: "team_lead",     label: "Team Lead",     blurb: "Lite manager tools" },
              { key: "sales_manager", label: "Sales Manager", blurb: "Full back-office" },
            ].map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setForm({ ...form, inviteRole: r.key as FormState["inviteRole"] })}
                className={[
                  "rounded-xl border px-4 py-3 text-left transition",
                  form.inviteRole === r.key ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300",
                ].join(" ")}
              >
                <div className={`text-sm font-semibold ${form.inviteRole === r.key ? "text-blue-700" : "text-gray-900"}`}>{r.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{r.blurb}</div>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Email addresses">
          <textarea
            rows={5}
            value={form.inviteEmails}
            onChange={(e) => setForm({ ...form, inviteEmails: e.target.value })}
            placeholder="alex@yourcompany.com&#10;jordan@yourcompany.com&#10;sam@yourcompany.com"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
          <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
            <span>One per line, or paste comma-separated.</span>
            <span className="font-semibold tabular-nums">{emailCount} email{emailCount === 1 ? "" : "s"}</span>
          </div>
        </Field>

        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900">
          <div className="font-semibold mb-1">💡 Don't worry about getting this perfect</div>
          You can invite more reps anytime from <span className="font-semibold">Manager → Team</span>.
        </div>
      </div>
    </div>
  );
}

function TerritoryStep({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  const zipCount = form.territoryZips.split(/[\s,;]+/).filter((s) => /^\d{5}$/.test(s)).length;
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Set your initial territory</h2>
      <p className="mt-1 text-gray-600">Drop in the zip codes you knock most. We'll preload your map with these areas and prioritize FCC coverage data here.</p>

      <div className="mt-6">
        <Field label="Zip codes">
          <textarea
            rows={4}
            value={form.territoryZips}
            onChange={(e) => setForm({ ...form, territoryZips: e.target.value })}
            placeholder="78701, 78702, 78703&#10;77001, 77002"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
          <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
            <span>Comma-separated or one per line.</span>
            <span className="font-semibold tabular-nums">{zipCount} valid zip{zipCount === 1 ? "" : "s"}</span>
          </div>
        </Field>

        <div className="mt-5 rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700">
          <div className="font-semibold text-gray-900 mb-1">Why we ask</div>
          Rouxte's map pulls AT&T fiber availability per address from the FCC. Telling us
          your service area lets us pre-fetch coverage so your reps see results instantly when
          they zoom in.
        </div>
      </div>
    </div>
  );
}

function DoneStep({ form }: { form: FormState }) {
  return (
    <div className="text-center">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-green-100 text-green-700 flex items-center justify-center text-3xl">✓</div>
      <h2 className="mt-6 text-3xl font-bold text-gray-900">You're set up.</h2>
      <p className="mt-3 text-gray-600 max-w-md mx-auto">
        Here's what we've got. We'll save this and take you on a quick product tour next.
      </p>

      <div className="mt-8 grid sm:grid-cols-2 gap-3 text-left">
        <SummaryCard
          icon="🏢"
          title="Org"
          rows={[
            ["Name", form.orgName || "—"],
            ["Niche", form.niche ? (form.niche === "both" ? "Fiber + Wireless" : form.niche.charAt(0).toUpperCase() + form.niche.slice(1)) : "—"],
            ["Carriers", form.carriers.length ? `${form.carriers.length} selected` : "—"],
          ]}
        />
        <SummaryCard
          icon="🎨"
          title="Branding"
          rows={[
            ["Color", <span key="c" className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ backgroundColor: form.brandColor }} />{form.brandColor}</span>],
            ["Logo", form.logoFile?.name ?? "—"],
          ]}
        />
        <SummaryCard
          icon="👥"
          title="Team"
          rows={[
            ["Invites queued", String(form.inviteEmails.split(/[\s,;]+/).filter((s) => /@/.test(s)).length)],
            ["Default role", form.inviteRole.replace("_", " ")],
          ]}
        />
        <SummaryCard
          icon="🗺️"
          title="Territory"
          rows={[
            ["Zip codes", String(form.territoryZips.split(/[\s,;]+/).filter((s) => /^\d{5}$/.test(s)).length)],
          ]}
        />
      </div>
    </div>
  );
}

function SummaryCard({ icon, title, rows }: { icon: string; title: string; rows: Array<[string, React.ReactNode]> }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <span className="font-semibold text-gray-900">{title}</span>
      </div>
      <dl className="space-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-gray-500">{k}</dt>
            <dd className="text-gray-900 font-medium text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold tracking-wide text-gray-600 uppercase mb-2">{label}</span>
      {children}
    </label>
  );
}
