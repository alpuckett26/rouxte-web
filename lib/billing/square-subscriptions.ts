/**
 * Square helpers for the subscription/trial flow.
 *
 * Approach: card-on-file, not Square Subscriptions API.
 * - On signup, we tokenize a card via Square Web Payments SDK (client),
 *   then create a Square Customer + save the card on file (server).
 * - We store square_customer_id + square_card_id on org_subscriptions.
 * - During trial we charge nothing.
 * - On day 31 a cron (`/api/cron/billing-renewal`) charges the saved
 *   card via the Payments API for tier price × rep count. That cron is
 *   out of scope for the demo MVP — the saved card and trial window
 *   are enough to demonstrate end-to-end signup.
 */

import { getSquare } from "@/lib/square";
import { randomUUID } from "node:crypto";

export interface CreateCustomerWithCardArgs {
  email: string;
  name: string;
  /** Card nonce from Square Web Payments SDK card.tokenize(). */
  sourceId: string;
  /** Optional verification token from buyer-verification flow (3DS / SCA). */
  verificationToken?: string;
}

export interface CustomerWithCard {
  customerId: string;
  cardId: string;
  cardBrand?: string;
  cardLast4?: string;
}

/**
 * Creates a Square Customer and saves the card on file in one logical step.
 * Customer is keyed by email — re-running this for the same email returns
 * the existing customer plus a new card.
 */
export async function createCustomerWithCard(
  args: CreateCustomerWithCardArgs,
): Promise<CustomerWithCard> {
  const square = getSquare();

  // 1. Find or create the Customer
  let customerId: string | undefined;

  try {
    const search = await square.customers.search({
      query: {
        filter: { emailAddress: { exact: args.email } },
      },
    });
    customerId = search.customers?.[0]?.id;
  } catch {
    // search failures are non-fatal — fall through to create
  }

  if (!customerId) {
    const [givenName, ...rest] = args.name.trim().split(/\s+/);
    const created = await square.customers.create({
      idempotencyKey: randomUUID(),
      givenName: givenName || args.name,
      familyName: rest.join(" ") || undefined,
      emailAddress: args.email,
    });
    customerId = created.customer?.id;
    if (!customerId) {
      throw new Error("Square: created customer but no id returned");
    }
  }

  // 2. Save the card on file
  const cardResult = await square.cards.create({
    idempotencyKey: randomUUID(),
    sourceId: args.sourceId,
    verificationToken: args.verificationToken,
    card: {
      customerId,
    },
  });

  const card = cardResult.card;
  if (!card?.id) {
    throw new Error("Square: card creation succeeded but no card id");
  }

  return {
    customerId,
    cardId: card.id,
    cardBrand: card.cardBrand,
    cardLast4: card.last4,
  };
}

/**
 * Charges the saved card-on-file for the given amount.
 * Used by the billing-renewal cron at end of trial.
 */
export async function chargeCardOnFile(args: {
  customerId: string;
  cardId: string;
  amountCents: number;
  note: string;
}): Promise<{ paymentId: string; status: string }> {
  const square = getSquare();
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!locationId) throw new Error("SQUARE_LOCATION_ID is not configured");

  const result = await square.payments.create({
    idempotencyKey: randomUUID(),
    sourceId: args.cardId,
    customerId: args.customerId,
    locationId,
    amountMoney: {
      amount: BigInt(args.amountCents),
      currency: "USD",
    },
    note: args.note,
    autocomplete: true,
  });

  const payment = result.payment;
  if (!payment?.id) throw new Error("Square: no payment id returned");

  return { paymentId: payment.id, status: payment.status ?? "UNKNOWN" };
}
