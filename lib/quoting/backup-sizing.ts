// Home backup power sizing — Tesla Powerwall 3 vs Briggs & Stratton standby.
// Ballpark only: gives the rep a direction for the conversation. The installer's
// load calculation and site survey set the real system. Mobile port lives in
// mobile/src/lib/backupSizing.ts — keep in sync.

export type ApplianceId =
  | "fridge"
  | "freezer"
  | "lights"
  | "electronics"
  | "furnace_blower"
  | "ac_3ton"
  | "ac_5ton"
  | "heat_pump"
  | "well_pump"
  | "sump_pump"
  | "water_heater"
  | "range"
  | "dryer"
  | "microwave"
  | "dishwasher"
  | "washer"
  | "medical"
  | "pool_pump"
  | "ev_charger";

export interface Appliance {
  id: ApplianceId;
  label: string;
  runningW: number;
  /** Surge while a motor starts. 0 = no motor (resistive / electronic load). */
  startingW: number;
  /** Typical energy over a 24h outage day (summer for cooling loads). */
  dailyKwh: number;
  group: "essentials" | "comfort" | "heavy";
}

// Typical nameplate-style values — conservative rules of thumb, not measurements.
export const APPLIANCES: Appliance[] = [
  { id: "fridge",         label: "Refrigerator",                runningW: 700,  startingW: 2200,  dailyKwh: 1.5, group: "essentials" },
  { id: "freezer",        label: "Chest freezer",               runningW: 500,  startingW: 1500,  dailyKwh: 1.2, group: "essentials" },
  { id: "lights",         label: "Lights & outlets",            runningW: 800,  startingW: 0,     dailyKwh: 4,   group: "essentials" },
  { id: "electronics",    label: "Wi-Fi, TV, computers",        runningW: 300,  startingW: 0,     dailyKwh: 2,   group: "essentials" },
  { id: "medical",        label: "Medical (CPAP, oxygen)",      runningW: 400,  startingW: 0,     dailyKwh: 5,   group: "essentials" },
  { id: "sump_pump",      label: "Sump pump (1/2 HP)",          runningW: 800,  startingW: 2000,  dailyKwh: 1,   group: "essentials" },
  { id: "well_pump",      label: "Well pump (1 HP)",            runningW: 1000, startingW: 3000,  dailyKwh: 2,   group: "essentials" },
  { id: "furnace_blower", label: "Gas furnace blower",          runningW: 800,  startingW: 2000,  dailyKwh: 6,   group: "comfort" },
  { id: "microwave",      label: "Microwave",                   runningW: 1200, startingW: 0,     dailyKwh: 0.5, group: "comfort" },
  { id: "dishwasher",     label: "Dishwasher",                  runningW: 1500, startingW: 0,     dailyKwh: 1.5, group: "comfort" },
  { id: "washer",         label: "Clothes washer",              runningW: 1200, startingW: 2400,  dailyKwh: 0.5, group: "comfort" },
  { id: "ac_3ton",        label: "Central AC (3 ton)",          runningW: 3500, startingW: 8500,  dailyKwh: 28,  group: "heavy" },
  { id: "ac_5ton",        label: "Central AC (5 ton)",          runningW: 5000, startingW: 12000, dailyKwh: 40,  group: "heavy" },
  { id: "heat_pump",      label: "Heat pump (3 ton)",           runningW: 4000, startingW: 9000,  dailyKwh: 35,  group: "heavy" },
  { id: "water_heater",   label: "Electric water heater",       runningW: 4500, startingW: 0,     dailyKwh: 12,  group: "heavy" },
  { id: "range",          label: "Electric range / oven",       runningW: 3000, startingW: 0,     dailyKwh: 3,   group: "heavy" },
  { id: "dryer",          label: "Electric dryer",              runningW: 5000, startingW: 0,     dailyKwh: 3,   group: "heavy" },
  { id: "pool_pump",      label: "Pool pump",                   runningW: 1500, startingW: 3500,  dailyKwh: 10,  group: "heavy" },
  { id: "ev_charger",     label: "EV charger (Level 2)",        runningW: 7200, startingW: 0,     dailyKwh: 20,  group: "heavy" },
];

export type Fuel = "natural_gas" | "propane" | "none";

export const FUEL_LABELS: Record<Fuel, string> = {
  natural_gas: "Natural gas",
  propane:     "Propane",
  none:        "No gas / propane yet",
};

export const OUTAGE_OPTIONS = [
  { hours: 8,   label: "Up to 8 hours" },
  { hours: 24,  label: "About a day" },
  { hours: 72,  label: "2–3 days" },
  { hours: 168, label: "A week or more" },
] as const;

// Briggs & Stratton PowerProtect / PowerProtect+ ratings (May 2026 launch release).
// Starting capability is published in kVA; treated as ≈ kW for motor-start checks.
export const GENERATORS = [
  { model: "PowerProtect 13 kW",  lpKw: 13, ngKw: 11.5, startKva: 37 },
  { model: "PowerProtect+ 18 kW", lpKw: 18, ngKw: 18,   startKva: 45 },
  { model: "PowerProtect+ 22 kW", lpKw: 22, ngKw: 22,   startKva: 45 },
  { model: "PowerProtect+ 26 kW", lpKw: 26, ngKw: 24,   startKva: 65.5 },
] as const;

// Tesla Powerwall 3 (NA datasheet).
export const POWERWALL = {
  kwh:          13.5,
  continuousKw: 11.5,
  maxUnits:     4,
  /** Powerwall 3 + up to 2 expansion units (40.5 kWh per system). */
  batteriesPerUnit: 3,
} as const;

/** Keep the generator at or under this share of its rating for continuous load. */
const GENERATOR_HEADROOM = 0.9;
/** Rough daily yield per kW of rooftop solar (varies by region and season). */
const SOLAR_KWH_PER_KW_DAY = 4;

export interface SizingInput {
  /** Quantity per appliance; missing or 0 = not on backup. */
  loads: Partial<Record<ApplianceId, number>>;
  fuel: Fuel;
  outageHours: number;
  /** Existing or planned rooftop solar, kW DC. 0 = none. */
  solarKw: number;
}

export type Recommendation = "generator" | "powerwall" | "hybrid";

export interface GeneratorPick {
  model: string;
  ratedKw: number;
  /** false = even the largest unit needs load management to cover this list. */
  fits: boolean;
}

export interface PowerwallPick {
  /** Total 13.5 kWh batteries (Powerwall 3 units + expansion units). */
  batteries: number;
  /** Powerwall 3 units needed for continuous power (each has its own inverter). */
  powerwall3Units: number;
  /** Within the 4-unit system limit. */
  fits: boolean;
}

export interface SizingResult {
  runningKw: number;
  startingKw: number;
  largestMotor: string | null;
  dailyKwh: number;
  outageKwh: number;
  solarKwhPerDay: number;
  generator: GeneratorPick | null;
  powerwall: PowerwallPick;
  recommendation: Recommendation;
  reasons: string[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function sizeBackup(input: SizingInput): SizingResult {
  const selected = APPLIANCES
    .map((a) => ({ a, qty: Math.max(0, Math.floor(input.loads[a.id] ?? 0)) }))
    .filter((x) => x.qty > 0);

  // Assumes everything selected can run at once — load management lowers this.
  const runningW = selected.reduce((s, x) => s + x.a.runningW * x.qty, 0);
  const dailyKwh = selected.reduce((s, x) => s + x.a.dailyKwh * x.qty, 0);

  // Worst case start: everything running, then the biggest motor kicks on.
  const motors = selected.filter((x) => x.a.startingW > 0);
  const biggest = motors.reduce<Appliance | null>(
    (best, x) => (!best || x.a.startingW - x.a.runningW > best.startingW - best.runningW ? x.a : best),
    null,
  );
  const startingW = biggest ? runningW - biggest.runningW + biggest.startingW : runningW;

  const runningKw = round1(runningW / 1000);
  const startingKw = round1(startingW / 1000);
  const outageDays = input.outageHours / 24;
  const outageKwh = round1(dailyKwh * outageDays);
  const solarKwhPerDay = round1(Math.max(0, input.solarKw) * SOLAR_KWH_PER_KW_DAY);

  // ── Generator ──────────────────────────────────────────────────────────────
  // No gas on site → quote as propane (a tank would be added).
  const ratingFor = (g: (typeof GENERATORS)[number]) => (input.fuel === "natural_gas" ? g.ngKw : g.lpKw);
  const genFit = GENERATORS.find(
    (g) => runningKw <= ratingFor(g) * GENERATOR_HEADROOM && startingKw <= g.startKva,
  );
  const genPick = genFit ?? GENERATORS[GENERATORS.length - 1];
  const generator: GeneratorPick = { model: genPick.model, ratedKw: ratingFor(genPick), fits: Boolean(genFit) };

  // ── Powerwall ──────────────────────────────────────────────────────────────
  const unitsForPower = Math.max(1, Math.ceil(runningKw / POWERWALL.continuousKw));
  // With solar, the battery only has to cover the overnight gap between recharges.
  const energyNeeded = solarKwhPerDay > 0 && outageDays >= 1
    ? Math.max(dailyKwh - solarKwhPerDay, dailyKwh * 0.5)
    : outageKwh;
  const batteries = Math.max(unitsForPower, Math.ceil(energyNeeded / POWERWALL.kwh));
  const powerwall3Units = Math.max(unitsForPower, Math.ceil(batteries / POWERWALL.batteriesPerUnit));
  const powerwall: PowerwallPick = {
    batteries,
    powerwall3Units,
    fits: powerwall3Units <= POWERWALL.maxUnits,
  };

  // ── Recommendation ─────────────────────────────────────────────────────────
  const reasons: string[] = [];
  const hasSolar = input.solarKw > 0;
  const longOutage = input.outageHours > 24;
  const heavyMotors = selected.some((x) => ["ac_3ton", "ac_5ton", "heat_pump", "well_pump", "pool_pump"].includes(x.a.id));
  const batteryHeavy = batteries > 3 || !powerwall.fits;

  let recommendation: Recommendation;
  if (input.fuel === "none" && !hasSolar && longOutage) {
    recommendation = batteryHeavy ? "generator" : "powerwall";
    reasons.push(batteryHeavy
      ? "Long outages without solar need fuel — a propane tank makes a generator possible."
      : "No gas on site; a battery covers this list without a fuel install.");
  } else if (input.fuel === "none") {
    recommendation = "powerwall";
    reasons.push("No natural gas or propane on site, so a battery is the simpler install.");
  } else if (hasSolar && !batteryHeavy) {
    recommendation = longOutage && heavyMotors ? "hybrid" : "powerwall";
    reasons.push("Solar recharges the battery daily, stretching it through multi-day outages.");
    if (recommendation === "hybrid") reasons.push("Big motor loads over several days — a generator backstops the battery.");
  } else if (longOutage || heavyMotors || batteryHeavy) {
    recommendation = hasSolar ? "hybrid" : "generator";
    if (longOutage) reasons.push("Outages longer than a day favor a fueled generator.");
    if (heavyMotors) reasons.push("Central AC, heat pumps and well pumps are large motor loads.");
    if (batteryHeavy) reasons.push(`Battery-only would take ${batteries} batteries.`);
    if (hasSolar) reasons.push("Existing solar adds a battery for silent, everyday value.");
  } else {
    recommendation = "powerwall";
    reasons.push("Short outages and modest loads fit a battery — silent and no fuel.");
  }

  if (!generator.fits) {
    reasons.push("This list exceeds the 26 kW unit — load management (Symphony) would shed some circuits.");
  }

  return {
    runningKw,
    startingKw,
    largestMotor: biggest?.label ?? null,
    dailyKwh: round1(dailyKwh),
    outageKwh,
    solarKwhPerDay,
    generator: input.fuel === "none" && recommendation === "powerwall" ? null : generator,
    powerwall,
    recommendation,
    reasons,
  };
}
