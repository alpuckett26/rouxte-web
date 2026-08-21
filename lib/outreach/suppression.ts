/**
 * The send gate (rouxte-web#18, item 2 and the caution).
 *
 * ONE function decides whether a given lead may be contacted on a given
 * channel, and every send path calls it — the dispatcher, a rep's manual send,
 * a one-off blast. It is deliberately pure: no database, no clock of its own,
 * no network. That is what makes it testable without a credential, and it is
 * why the dispatcher can re-run it against a FRESHLY READ row immediately
 * before handing bytes to Resend.
 *
 * THE POINT OF "AT SEND TIME": a removal that only applies at import is not a
 * removal. Somebody who unsubscribes at 14:02 must not receive the email that
 * a dispatcher loaded into memory at 14:01. So the gate is cheap enough to run
 * twice — once to select the batch, once against a re-read row at the moment of
 * send — and the dispatcher does exactly that.
 *
 * THE PROVENANCE RULE: a contact with no `contact_source` / `contact_sourced_at`
 * is NOT SENDABLE. Not "sendable with a caveat" — not sendable. Everything this
 * system sends goes to somebody who never asked to hear from us, and the only
 * thing separating that from burning the sending domain is being able to answer
 * "why did you email me" on demand. A burned domain takes the receipts and the
 * daily reports down with it, so the cost of a wrong send is not one bad email.
 */

export type OutreachChannel = "email" | "phone" | "sms" | "door" | "mail";

export type SuppressionReason =
  /** do_not_contact is set — by the spine, an unsubscribe, a bounce or a human. */
  | "do_not_contact"
  /** The door-knock opt-out register (leads.is_opt_out / opt_out_addresses). */
  | "opted_out"
  /** Door channel only: the address is flagged do-not-knock. */
  | "do_not_knock"
  /** No address to send to on this channel (no email, no phone…). */
  | "no_address"
  /** We cannot say where this contact came from. See the provenance rule above. */
  | "no_provenance"
  /** The channel itself is not configured (e.g. RESEND_API_KEY absent). */
  | "channel_unavailable";

export interface SendGateSubject {
  id?: string;
  do_not_contact?: boolean | null;
  is_opt_out?: boolean | null;
  is_do_not_knock?: boolean | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  phone?: string | null;
  contact_source?: string | null;
  contact_sourced_at?: string | null;
}

export interface SendGateOptions {
  /**
   * False when the channel's transport is not configured. Passed in rather
   * than read from process.env here so the gate stays pure and the proof
   * harness can exercise the branch.
   */
  channelConfigured?: boolean;
}

export type SendGateVerdict =
  | { allowed: true; channel: OutreachChannel; to: string; provenance: { source: string; sourcedAt: string } }
  | { allowed: false; channel: OutreachChannel; reason: SuppressionReason; detail: string };

/** Human-readable, and written to the ledger — so keep them explanatory. */
const DETAIL: Record<SuppressionReason, string> = {
  do_not_contact: "lead is marked do_not_contact",
  opted_out: "lead or its address is on the opt-out register",
  do_not_knock: "address is flagged do-not-knock",
  no_address: "no deliverable address for this channel",
  no_provenance:
    "contact has no source/sourced_at — we could not answer \"why did you email me\", so this is not sendable",
  channel_unavailable: "channel transport is not configured",
};

function trimmed(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

/** The address this channel would actually deliver to, or null. */
export function destinationFor(subject: SendGateSubject, channel: OutreachChannel): string | null {
  switch (channel) {
    case "email":
      return trimmed(subject.contact_email);
    case "phone":
    case "sms":
      return trimmed(subject.contact_phone) ?? trimmed(subject.phone);
    case "door":
    case "mail":
      // Physical channels deliver to the lead's address, which upsertLead
      // guarantees is present — they still pass the gate for the opt-out and
      // do-not-knock checks, which is the whole reason they are listed.
      return "address-on-file";
  }
}

/**
 * Decide whether this subject may be contacted on this channel, right now.
 *
 * Order matters and is not arbitrary: the two REFUSALS OF CONSENT come first,
 * so a suppressed lead is reported as suppressed even when it also happens to
 * have no email. "We didn't have an address" is a materially different answer
 * to a compliance question than "they told us to stop", and the ledger records
 * whichever this returns.
 */
export function evaluateSendGate(
  subject: SendGateSubject,
  channel: OutreachChannel,
  options: SendGateOptions = {},
): SendGateVerdict {
  const deny = (reason: SuppressionReason): SendGateVerdict => ({
    allowed: false,
    channel,
    reason,
    detail: DETAIL[reason],
  });

  if (subject.do_not_contact === true) return deny("do_not_contact");
  if (subject.is_opt_out === true) return deny("opted_out");
  if (channel === "door" && subject.is_do_not_knock === true) return deny("do_not_knock");

  if (options.channelConfigured === false) return deny("channel_unavailable");

  const to = destinationFor(subject, channel);
  if (!to) return deny("no_address");

  // The provenance rule. Applied to the COLD channels only: email, sms and
  // mail reach someone who never asked, and are the ones that burn a domain or
  // a number. A rep phoning or knocking a business address is a different act
  // with a different record, and the door lane already has its own compliance
  // events in sales_activity_log.
  if (channel === "email" || channel === "sms" || channel === "mail") {
    const source = trimmed(subject.contact_source);
    const sourcedAt = trimmed(subject.contact_sourced_at);
    if (!source || !sourcedAt) return deny("no_provenance");
    return { allowed: true, channel, to, provenance: { source, sourcedAt } };
  }

  return {
    allowed: true,
    channel,
    to,
    provenance: {
      source: trimmed(subject.contact_source) ?? "rep_field",
      sourcedAt: trimmed(subject.contact_sourced_at) ?? "",
    },
  };
}

/**
 * Whether a spine sync is permitted to CLEAR an existing suppression.
 *
 * The inverse of the item-2 rule, and just as important: if a sync could
 * un-suppress, then every unsubscribe would survive exactly until the next
 * 15-minute cron. The spine may only ever retract a flag the spine itself set;
 * an unsubscribe, a bounce, a complaint or a human decision is ours and outlives
 * anything upstream says.
 *
 * An UNKNOWN source (null) does not clear either. A suppression we cannot
 * attribute is one we cannot safely retract — the same refuse-when-unsure rule
 * the adopt gate runs on, and here the cost of guessing wrong is mailing
 * somebody who told us to stop.
 */
export function syncMayClearSuppression(currentSource: string | null | undefined): boolean {
  return currentSource === "spine";
}
