import { sizeBackup, type ApplianceId, type Fuel, type Recommendation } from "@/lib/quoting/backup-sizing";

// Backup-power funnel (/r/[slug]/backup) — answer options, lead scoring and the
// sizing teaser shown to the homeowner after they submit.

export const OWNERSHIP  = ["own", "rent"] as const;
export const WORRIES    = ["frequent", "storms", "medical", "work_home", "food", "curious"] as const;
export const KEEP       = ["essentials", "hvac", "water", "medical", "whole_home"] as const;
export const OUTAGES    = ["8", "24", "72", "168"] as const;
export const FUELS      = ["natural_gas", "propane", "none", "unsure"] as const;
export const SOLAR      = ["yes", "planning", "no"] as const;
export const TIMELINES  = ["asap", "months", "year", "researching"] as const;

export interface BackupAnswers {
  ownership: (typeof OWNERSHIP)[number];
  worry: (typeof WORRIES)[number];
  keep: (typeof KEEP)[number][];
  outage: (typeof OUTAGES)[number];
  fuel: (typeof FUELS)[number];
  solar: (typeof SOLAR)[number];
  timeline: (typeof TIMELINES)[number];
  address: string;
  city: string;
  zip: string;
  customer_name: string;
  phone: string;
  email?: string;
  sms_consent: boolean;
}

export const WORRY_LABELS: Record<BackupAnswers["worry"], string> = {
  frequent:  "Outages happen often",
  storms:    "Storm / hurricane / ice season",
  medical:   "Medical equipment at home",
  work_home: "Working from home",
  food:      "Losing food and comfort",
  curious:   "Just exploring options",
};

export const KEEP_LABELS: Record<BackupAnswers["keep"][number], string> = {
  essentials: "Fridge, lights, Wi-Fi",
  hvac:       "Heat / AC",
  water:      "Well or sump pump",
  medical:    "Medical equipment",
  whole_home: "Whole home",
};

export const TIMELINE_LABELS: Record<BackupAnswers["timeline"], string> = {
  asap:        "As soon as possible",
  months:      "In the next 1–3 months",
  year:        "This year",
  researching: "Just researching",
};

const KEEP_LOADS: Record<BackupAnswers["keep"][number], Partial<Record<ApplianceId, number>>> = {
  essentials: { fridge: 1, lights: 1, electronics: 1 },
  hvac:       { ac_3ton: 1, furnace_blower: 1 },
  water:      { well_pump: 1, sump_pump: 1 },
  medical:    { medical: 1 },
  whole_home: { fridge: 1, lights: 1, electronics: 1, ac_5ton: 1, furnace_blower: 1, microwave: 1, washer: 1, water_heater: 1 },
};

const REC_LABELS: Record<Recommendation, string> = {
  generator: "Home standby generator",
  powerwall: "Battery backup (Powerwall)",
  hybrid:    "Battery + generator",
};

export interface BackupTeaser {
  recommendation: Recommendation;
  headline: string;
  size: string;
  reasons: string[];
}

export function backupTeaser(a: BackupAnswers): BackupTeaser {
  const loads: Partial<Record<ApplianceId, number>> = {};
  for (const k of a.keep.length ? a.keep : (["essentials"] as const)) {
    for (const [id, qty] of Object.entries(KEEP_LOADS[k]) as [ApplianceId, number][]) {
      loads[id] = Math.max(loads[id] ?? 0, qty);
    }
  }
  const fuel: Fuel = a.fuel === "unsure" ? "none" : a.fuel;
  const r = sizeBackup({ loads, fuel, outageHours: Number(a.outage), solarKw: a.solar === "yes" ? 7 : 0 });

  const battery = `${r.powerwall.batteries} battery${r.powerwall.batteries === 1 ? "" : " units"} (${(r.powerwall.batteries * 13.5).toFixed(1)} kWh)`;
  const gen = r.generator ? `about ${r.generator.ratedKw} kW` : "";
  const size =
    r.recommendation === "generator" ? `Generator ${gen}`
    : r.recommendation === "powerwall" ? battery
    : `${battery} + generator ${gen}`;

  return { recommendation: r.recommendation, headline: REC_LABELS[r.recommendation], size, reasons: r.reasons.slice(0, 2) };
}

export interface BackupScore {
  score: number;
  temperature: "hot" | "warm" | "cold";
  recommended_pitch: string;
  teaser: BackupTeaser;
}

export function scoreBackup(a: BackupAnswers): BackupScore {
  let score = 0;

  if (a.ownership === "own") score += 20;

  if      (a.timeline === "asap")   score += 25;
  else if (a.timeline === "months") score += 15;
  else if (a.timeline === "year")   score += 8;

  if      (a.worry === "frequent" || a.worry === "medical") score += 15;
  else if (a.worry === "storms")                            score += 12;
  else if (a.worry === "work_home")                         score += 10;
  else if (a.worry === "food")                              score += 6;

  if (Number(a.outage) >= 72) score += 5;
  if (a.solar === "yes") score += 5;

  if (a.phone?.trim())   score += 10;
  if (a.address?.trim()) score += 10;

  score = Math.min(score, 100);

  // Renters can't sign for a permanent install — keep them out of the hot list.
  const temperature: BackupScore["temperature"] =
    a.ownership === "rent" ? "cold" : score >= 80 ? "hot" : score >= 50 ? "warm" : "cold";

  const teaser = backupTeaser(a);
  return { score, temperature, recommended_pitch: buildPitch(a, temperature, teaser), teaser };
}

function buildPitch(a: BackupAnswers, temperature: BackupScore["temperature"], t: BackupTeaser): string {
  const urgency = temperature === "hot"
    ? "High priority — call today and book the site visit."
    : temperature === "warm"
    ? "Engaged — follow up within 24 hours."
    : "Nurture — send the guide and check back.";

  const parts: string[] = [`Backup power: ballpark ${t.headline} — ${t.size}.`];
  if (a.ownership === "rent") parts.push("Renter: the landlord has to approve and sign — ask who owns the home.");
  if (a.worry === "medical" || a.keep.includes("medical")) {
    parts.push("Medical equipment at home — lead with reliability and automatic switchover; ask about the utility's medical-needs registry.");
  }
  if (a.solar === "yes") parts.push("Has solar — a battery adds everyday savings, not just backup.");
  if (a.fuel === "none" || a.fuel === "unsure") parts.push("No confirmed gas line — confirm fuel before quoting a generator.");
  parts.push(urgency);
  return parts.join(" ");
}

export function backupNote(a: BackupAnswers, s: BackupScore): string {
  return [
    "Backup power funnel submission",
    `Owns home: ${a.ownership === "own" ? "yes" : "no (renter)"}`,
    `Main concern: ${WORRY_LABELS[a.worry]}`,
    `Wants to keep running: ${a.keep.map((k) => KEEP_LABELS[k]).join(", ") || "not specified"}`,
    `Longest outage to cover: ${a.outage} hours`,
    `Fuel: ${a.fuel.replace("_", " ")} · Solar: ${a.solar}`,
    `Timeline: ${TIMELINE_LABELS[a.timeline]}`,
    `Ballpark: ${s.teaser.headline} — ${s.teaser.size}`,
    `Score: ${s.score}/100 (${s.temperature})`,
  ].join("\n");
}
