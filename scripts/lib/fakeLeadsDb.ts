/**
 * An in-memory stand-in for the Supabase admin client, good enough to drive the
 * REAL `upsertAnswersLead` with no database, no credential and no network.
 *
 * Shared by `scripts/answers-adopt-proof.ts` (does the gate decide correctly on
 * constructed cases) and `scripts/answers-insert-dryrun.ts` (what will the live
 * pass actually do to the real feed). One implementation on purpose: if the two
 * harnesses each carried their own fake, a divergence between them would read
 * as a disagreement about the sync rules instead of what it is — a bug in a
 * test double.
 *
 * It implements only the query surface upsertLead uses: select/eq/is/ilike/
 * limit/order/maybeSingle/single, insert(...).select().single(), and
 * update(...).eq(). Anything else is deliberately absent so that a new query
 * shape in the shipping code fails loudly here rather than being silently
 * mocked away.
 */

import type { createAdminClient } from "../../lib/supabase/admin";

export const FAKE_ORG = "org-0000";
export const FAKE_ACTOR = "actor-0000";

export interface Row {
  id: string;
  org_id: string;
  status: string;
  address: string | null;
  customer_name: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  assigned_to: string | null;
  external_source: string | null;
  external_ref: string | null;
  [key: string]: unknown;
}

type Filter = (row: Row) => boolean;

function ilikeToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

export class FakeDb {
  rows: Row[] = [];
  inserts: Record<string, Record<string, unknown>[]> = {};
  private seq = 0;

  seed(row: Partial<Row> & { address: string }): Row {
    this.seq += 1;
    const full: Row = {
      id: `lead-${this.seq}`,
      org_id: FAKE_ORG,
      status: "new",
      customer_name: null,
      phone: null,
      lat: null,
      lng: null,
      assigned_to: null,
      external_source: null,
      external_ref: null,
      ...row,
    };
    this.rows.push(full);
    return full;
  }

  from(table: string) {
    const db = this;
    return {
      select() {
        const filters: Filter[] = [];
        let cap = Infinity;
        const api = {
          eq(col: string, val: unknown) {
            filters.push((r) => r[col] === val);
            return api;
          },
          is(col: string, val: unknown) {
            filters.push((r) => (val === null ? r[col] === null || r[col] === undefined : r[col] === val));
            return api;
          },
          ilike(col: string, pattern: string) {
            const re = ilikeToRegExp(pattern);
            filters.push((r) => typeof r[col] === "string" && re.test(r[col] as string));
            return api;
          },
          limit(n: number) {
            cap = n;
            return api;
          },
          order() {
            return api;
          },
          rows(): Row[] {
            if (table !== "leads") return [];
            return db.rows.filter((r) => filters.every((f) => f(r))).slice(0, cap);
          },
          async maybeSingle() {
            const found = api.rows();
            return { data: found[0] ?? null, error: null };
          },
          async single() {
            const found = api.rows();
            return { data: found[0] ?? null, error: found[0] ? null : { message: "no rows" } };
          },
          // Awaiting the builder directly (no maybeSingle) returns the set.
          then(resolve: (v: { data: Row[]; error: null }) => unknown) {
            return Promise.resolve({ data: api.rows(), error: null }).then(resolve);
          },
        };
        return api;
      },

      insert(values: Record<string, unknown>) {
        (db.inserts[table] ||= []).push(values);
        let created: Row | null = null;
        if (table === "leads") {
          db.seq += 1;
          created = { id: `lead-${db.seq}`, ...(values as Partial<Row>) } as Row;
          db.rows.push(created);
        }
        const result = { data: created, error: null };
        return {
          select() {
            return {
              async single() {
                return result;
              },
            };
          },
          then(resolve: (v: typeof result) => unknown) {
            return Promise.resolve(result).then(resolve);
          },
        };
      },

      update(patch: Record<string, unknown>) {
        return {
          async eq(col: string, val: unknown) {
            for (const row of db.rows) {
              if (row[col] === val) Object.assign(row, patch);
            }
            return { error: null };
          },
        };
      },
    };
  }
}

/** The cast is the one lie in here, and it is confined to this line. */
export const asAdmin = (db: FakeDb) => db as unknown as ReturnType<typeof createAdminClient>;
