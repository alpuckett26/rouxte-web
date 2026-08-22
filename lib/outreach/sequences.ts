/**
 * Sequence definitions and their scheduling (rouxte-web#18, items 1 and 3).
 *
 * In code, not in a table, for one reason: the GloriaFood cadence is computed
 * against an externally imposed date, so it is a FUNCTION OF TIME rather than a
 * fixed list of offsets. A step table would freeze a schedule that is supposed
 * to compress as the shutdown nears, and would then be quietly wrong for
 * exactly as long as nobody re-read it.
 *
 * Copy lives here too. It is deliberately short, names the reason we are
 * writing, and carries no price — pricing is Aaron's gate, not a template's.
 */

import type { OutreachChannel } from "./suppression";

/**
 * GloriaFood's shutdown. A real, externally imposed date — the entire reason
 * `signals.gloriafood` exists on the spine record, and the only thing in this
 * file that is not ours to change.
 */
export const GLORIAFOOD_SHUTDOWN_AT = "2027-04-30T00:00:00.000Z";

export const MS_PER_DAY = 86_400_000;

export interface SequenceStep {
  /** 1-based. Step 0 in the cursor means "enrolled, nothing sent yet". */
  step: number;
  channel: OutreachChannel;
  /** Days after the PREVIOUS touch, before any anchor compression. */
  delayDays: number;
  subject: string;
  /** Rendered with renderStep(); `{{name}}` and `{{deadline}}` are substituted. */
  body: string;
}

export interface SequenceDefinition {
  key: string;
  name: string;
  description: string;
  /**
   * The signal whose SEGMENT defines this cohort. Read from the spine, never
   * derived locally — four rails deriving the same list separately is four
   * rails disagreeing quietly.
   */
  signal: string | null;
  steps: SequenceStep[];
  /**
   * ISO date after which this sequence is meaningless and must stop. A pitch
   * built on a deadline is worse than silence once the deadline has passed.
   */
  anchorAt?: string;
  /**
   * Do not ENROL anyone with less than this much runway to the anchor. A
   * four-touch sequence started nine days out is three emails nobody reads and
   * one relationship spent.
   */
  minRunwayDays?: number;
}

const GLORIAFOOD_BODY_INTRO = `Hi{{name}},

GloriaFood is shutting down on {{deadline}}. If that is what takes your online
orders today, they stop working that day — the ordering page, the links on your
Facebook and Google listings, all of it.

We build the replacement for restaurants around Baton Rouge: your own ordering
page plus a phone line that answers and takes the order when nobody can get to
the phone. Orders land in your existing POS.

Worth a ten-minute call before the rush of everyone moving at once?

— Aaron, Anseur`;

const GLORIAFOOD_BODY_FOLLOWUP = `Hi{{name}},

Following up on the GloriaFood shutdown ({{deadline}}). The part restaurants
usually miss is the LINKS: your Google and Facebook "Order Online" buttons point
at GloriaFood, and on that date they start going nowhere. Those need repointing
whoever you move to.

Happy to just tell you what to change even if you go elsewhere.

— Aaron, Anseur`;

const GLORIAFOOD_BODY_VALUE = `Hi{{name}},

One more on {{deadline}}. We have a live example running here in Baton Rouge —
ordering page plus an AI phone line that picks up when the kitchen is slammed,
takes the order, and reads it back. It is the calls nobody answers that are the
real money, not the website.

Ten minutes and I will show you it working on a real order.

— Aaron, Anseur`;

const GLORIAFOOD_BODY_LAST = `Hi{{name}},

Last one from me on this. {{deadline}} is close and switching takes longer than
people expect once everyone starts at the same time.

If you already have somewhere to move to, genuinely good — ignore this. If not,
reply and I will get you set up.

— Aaron, Anseur`;

export const SEQUENCES: Record<string, SequenceDefinition> = {
  gloriafood_shutdown: {
    key: "gloriafood_shutdown",
    name: "GloriaFood shutdown",
    description:
      "Four touches timed off the GloriaFood shutdown date. Cadence compresses as the date nears; the sequence stops dead once it passes.",
    signal: "gloriafood",
    anchorAt: GLORIAFOOD_SHUTDOWN_AT,
    minRunwayDays: 21,
    steps: [
      { step: 1, channel: "email", delayDays: 0, subject: "GloriaFood shuts down {{deadline}}", body: GLORIAFOOD_BODY_INTRO },
      { step: 2, channel: "email", delayDays: 7, subject: "Your Google and Facebook order links, after {{deadline}}", body: GLORIAFOOD_BODY_FOLLOWUP },
      { step: 3, channel: "email", delayDays: 14, subject: "The calls nobody answers", body: GLORIAFOOD_BODY_VALUE },
      { step: 4, channel: "email", delayDays: 21, subject: "Last note on the {{deadline}} deadline", body: GLORIAFOOD_BODY_LAST },
    ],
  },

  owner_direct: {
    key: "owner_direct",
    name: "Owner direct",
    description:
      "Two touches to a verified owner address, no external deadline. Unanchored, so the cadence never compresses.",
    signal: "owner_com",
    steps: [
      {
        step: 1,
        channel: "email",
        delayDays: 0,
        subject: "Your phone line, when nobody can get to it",
        body: `Hi{{name}},

We run an AI phone line for restaurants around Baton Rouge — it answers when the
kitchen is slammed, takes the order, reads it back, and drops it into your POS.
There is a live one you can call.

Worth ten minutes?

— Aaron, Anseur`,
      },
      {
        step: 2,
        channel: "email",
        delayDays: 10,
        subject: "Following up",
        body: `Hi{{name}},

Circling back once. If the phone is not your bottleneck, say so and I will stop —
no hard feelings, and I will not email again.

— Aaron, Anseur`,
      },
    ],
  },
};

export function getSequence(key: string): SequenceDefinition | null {
  return SEQUENCES[key] ?? null;
}

export function stepOf(seq: SequenceDefinition, step: number): SequenceStep | null {
  return seq.steps.find((s) => s.step === step) ?? null;
}

/**
 * How hard to compress the cadence, given how much runway is left.
 *
 * The reason this exists: a 21-day gap between touch 3 and touch 4 is fine in
 * October and useless in April, because the last email lands after the thing it
 * is warning about already happened. Compression keeps the whole sequence
 * inside the runway.
 *
 * Unanchored sequences always return 1 — nothing to compress against.
 */
export function cadenceFactor(seq: SequenceDefinition, now: Date): number {
  if (!seq.anchorAt) return 1;
  const days = daysUntil(seq.anchorAt, now);
  if (days <= 30) return 0.25;
  if (days <= 90) return 0.5;
  return 1;
}

export function daysUntil(iso: string, now: Date): number {
  return (new Date(iso).getTime() - now.getTime()) / MS_PER_DAY;
}

/**
 * When the next step is due, or null when the sequence is finished.
 *
 * `from` is the time the previous touch landed (or the enrolment time for step
 * 1). The compressed delay is floored at 2 days so a heavily compressed
 * sequence still reads as follow-up rather than as a machine gun — four emails
 * in four days is how a domain gets reported, and the deadline is a reason to
 * be timely, not a licence to be relentless.
 */
export function nextDueAt(
  seq: SequenceDefinition,
  nextStep: number,
  from: Date,
  now: Date = from,
): Date | null {
  const step = stepOf(seq, nextStep);
  if (!step) return null;
  if (step.delayDays === 0) return new Date(from.getTime());
  const compressed = Math.max(2, Math.round(step.delayDays * cadenceFactor(seq, now)));
  return new Date(from.getTime() + compressed * MS_PER_DAY);
}

export type EnrolmentRefusal = "anchor_passed" | "insufficient_runway";

/**
 * May we start this sequence for someone, right now? Timing only — consent and
 * deliverability are the send gate's job, and both must pass.
 */
export function canEnrol(
  seq: SequenceDefinition,
  now: Date,
): { ok: true } | { ok: false; reason: EnrolmentRefusal; detail: string } {
  if (!seq.anchorAt) return { ok: true };
  const days = daysUntil(seq.anchorAt, now);
  if (days <= 0) {
    return {
      ok: false,
      reason: "anchor_passed",
      detail: `${seq.key}: the anchor date ${seq.anchorAt.slice(0, 10)} has passed — a deadline pitch after the deadline is worse than silence`,
    };
  }
  const min = seq.minRunwayDays ?? 0;
  if (days < min) {
    return {
      ok: false,
      reason: "insufficient_runway",
      detail: `${seq.key}: ${days.toFixed(1)} days to ${seq.anchorAt.slice(0, 10)}, below the ${min}-day minimum runway — not enough room to run the sequence without cramming it`,
    };
  }
  return { ok: true };
}

/**
 * Should an already-running sequence stop because its anchor passed? Checked at
 * dispatch, not only at enrolment: a sequence enrolled with plenty of runway
 * still reaches the date eventually.
 */
export function anchorExpired(seq: SequenceDefinition, now: Date): boolean {
  return Boolean(seq.anchorAt) && daysUntil(seq.anchorAt!, now) <= 0;
}

/** Format the anchor for copy: "April 30, 2027". */
export function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export interface RenderedStep {
  subject: string;
  body: string;
}

/**
 * Substitute the two placeholders. `{{name}}` renders as " Marie" or as the
 * empty string — never as "Hi there," or "Hi Owner,", because a greeting that
 * announces we do not know who you are is worse than no greeting at all.
 */
export function renderStep(
  seq: SequenceDefinition,
  step: SequenceStep,
  vars: { contactName?: string | null },
): RenderedStep {
  const first = (vars.contactName ?? "").trim().split(/\s+/)[0] ?? "";
  const name = first ? ` ${first}` : "";
  const deadline = seq.anchorAt ? formatDeadline(seq.anchorAt) : "";
  const fill = (s: string) => s.replaceAll("{{name}}", name).replaceAll("{{deadline}}", deadline);
  return { subject: fill(step.subject), body: fill(step.body) };
}

/**
 * The unsubscribe footer. Every outbound email carries it, and it states the
 * provenance inline — the recipient never asked to hear from us, so the answer
 * to "why did you email me" ships WITH the email rather than waiting to be
 * demanded.
 */
export function footer(unsubscribeUrl: string, provenance: { source: string; sourcedAt: string }): string {
  const when = provenance.sourcedAt ? ` on ${provenance.sourcedAt.slice(0, 10)}` : "";
  return `

---
You are receiving this because we found your restaurant's contact listed via ${provenance.source}${when}.
Not interested? One click and we stop, permanently: ${unsubscribeUrl}`;
}
