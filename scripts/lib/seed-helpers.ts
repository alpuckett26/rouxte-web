import type { SupabaseClient } from "@supabase/supabase-js";

export const DEMO_PASSWORD = "rouxte-demo";

export const FIRST_NAMES = [
  "Alex", "Jordan", "Sam", "Taylor", "Casey", "Morgan", "Riley", "Quinn",
  "Cameron", "Avery", "Hayden", "Skyler", "Parker", "Rowan", "Sage", "Drew",
  "Devon", "Reese", "Jamie", "Kennedy", "Logan", "Charlie", "Robin", "Frankie",
  "Marcus", "Diego", "Priya", "Aisha", "Mateo", "Zara", "Kai", "Imani",
  "Sofia", "Felix", "Nadia", "Tobias", "Lila", "Omar", "Maya", "Theo",
  "Ines", "Rafael", "Camila", "Ezra", "Yuki", "Anika", "Bodhi", "Cleo",
];

export const LAST_NAMES = [
  "Carter", "Reed", "Bennett", "Foster", "Hayes", "Ward", "Lane", "Price",
  "Brooks", "Knox", "Pierce", "Walsh", "Stone", "Cole", "Murphy", "Hunt",
  "Bailey", "Morgan", "Ellis", "Tate", "Quinn", "Webb", "Russo", "Lopez",
  "Patel", "Nguyen", "Singh", "Kim", "Khan", "Garcia", "Wright", "Holt",
  "Park", "Reyes", "Diaz", "Yamamoto", "Okafor", "Hassan", "Saito", "Mora",
];

export function pickName(seed: number): { first: string; last: string; full: string } {
  const first = FIRST_NAMES[seed % FIRST_NAMES.length];
  const last = LAST_NAMES[(seed * 7) % LAST_NAMES.length];
  return { first, last, full: `${first} ${last}` };
}

export function rand(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function randomDateInLastDays(days: number, minDaysAgo = 0): Date {
  const range = (days - minDaysAgo) * 24 * 60 * 60 * 1000;
  const ms = minDaysAgo * 24 * 60 * 60 * 1000 + Math.random() * range;
  return new Date(Date.now() - ms);
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function weighted<T>(items: readonly [T, number][]): T {
  const total = items.reduce((acc, [, w]) => acc + w, 0);
  let r = Math.random() * total;
  for (const [item, w] of items) {
    if ((r -= w) <= 0) return item;
  }
  return items[items.length - 1][0];
}

/**
 * Wipes demo orgs (and their auth users) matching the given prefix.
 *
 * Calls the `force_wipe_demo_orgs` RPC, which is a SECURITY DEFINER function
 * that briefly enables a session-local bypass of the sales_activity_log
 * append-only trigger so the cascade can proceed. The RPC accepts only
 * `[DEMO%`-prefixed patterns; any other prefix is rejected DB-side.
 *
 * If the RPC isn't installed yet, you'll get a clear error pointing at the
 * one-shot SQL block.
 */
export async function wipeOrgsByPrefix(
  supabase: SupabaseClient,
  prefix: string,
): Promise<void> {
  const match = `${prefix} %`;
  console.log(`Wiping existing orgs matching "${match}"...`);

  const { data, error } = await supabase.rpc("force_wipe_demo_orgs", {
    p_name_prefix: match,
  });

  if (error) {
    if (error.message.includes("function") || error.message.includes("does not exist")) {
      throw new Error(
        `force_wipe_demo_orgs RPC missing. Run the demo seed plumbing SQL block first.\n  underlying: ${error.message}`,
      );
    }
    throw new Error(`wipe failed: ${error.message}`);
  }

  const result = (data ?? { orgs_wiped: 0, auth_users_wiped: 0 }) as {
    orgs_wiped: number;
    auth_users_wiped: number;
  };
  console.log(`  wiped ${result.orgs_wiped} org(s) + ${result.auth_users_wiped} auth users.`);
}

/**
 * Safety-net cleanup. Lists every auth user whose email ends with `@<domain>`
 * (paginating up to 5000) and deletes them. Useful for sweeping stale users
 * left behind by earlier failed seed runs where wipeOrgsByPrefix couldn't
 * delete them (e.g. RESTRICT FK from sales_activity_log when org wasn't
 * deleted first).
 */
export async function cleanupAuthUsersByEmailDomain(
  supabase: SupabaseClient,
  domain: string,
): Promise<void> {
  const suffix = `@${domain.toLowerCase()}`;
  const toDelete: string[] = [];
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.warn(`  listUsers page ${page} failed: ${error.message}`);
      break;
    }
    const users = data?.users ?? [];
    if (users.length === 0) break;
    for (const u of users) {
      if (u.email?.toLowerCase().endsWith(suffix)) toDelete.push(u.id);
    }
    if (users.length < 200) break;
  }
  if (toDelete.length === 0) return;
  console.log(`  sweeping ${toDelete.length} stale auth users @${domain}...`);
  let failed = 0;
  for (const uid of toDelete) {
    const { error } = await supabase.auth.admin.deleteUser(uid);
    if (error) failed++;
  }
  if (failed > 0) console.warn(`    ${failed}/${toDelete.length} sweep deletes failed`);
}
