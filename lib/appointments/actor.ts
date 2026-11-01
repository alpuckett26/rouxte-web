// Shared plumbing for the Setter → Closer → Sale routes (rouxte-web#19).
//
// Every /api/appointments/* handler needs the same three things: who is
// calling, which org they are in, and — because migration 043 is not applied
// everywhere yet — a way to tell "this table does not exist" apart from "this
// query found nothing". The second distinction is the whole reason this file
// exists rather than the logic being copy-pasted five times.

import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type { UserRole, SalesFunction } from "@/lib/types";

export interface Actor {
  userId: string;
  orgId: string;
  teamId: string | null;
  role: UserRole;
  fullName: string | null;
}

/** Roles that may act on any appointment in the org, not just their own. */
const MANAGER_ROLES: UserRole[] = ["admin", "sales_manager", "team_lead"];

export function isManager(role: UserRole): boolean {
  return MANAGER_ROLES.includes(role);
}

/**
 * Resolve the caller. Returns a NextResponse on failure so handlers can
 * `if ("error" in a) return a.error;` in one line.
 */
export async function loadActor(): Promise<{ actor: Actor } | { error: NextResponse }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id, team_id, role, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.org_id) {
    return { error: NextResponse.json({ error: "Profile not found" }, { status: 400 }) };
  }

  return {
    actor: {
      userId: user.id,
      orgId: profile.org_id as string,
      teamId: (profile.team_id as string | null) ?? null,
      role: profile.role as UserRole,
      fullName: (profile.full_name as string | null) ?? null,
    },
  };
}

/**
 * Postgres 42P01 = undefined_table. Migration 043 ships in this branch and is
 * applied by a human, so until then every route here queries a table that is
 * not there. A 500 with "relation does not exist" buried in it reads as a bug;
 * a 503 that says which migration is missing reads as an instruction.
 */
export function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01") return true;
  return /relation ".*(sales_appointments|sale_attributions|rep_deployments)" does not exist/i
    .test(error.message ?? "");
}

export function migrationPending(): NextResponse {
  return NextResponse.json(
    {
      error:
        "Setter/Closer tables are not present in this database. " +
        "Apply supabase/migrations/043_closer_phase1.sql, then retry.",
      code: "migration_043_pending",
    },
    { status: 503 },
  );
}

/**
 * Look up display names for a set of user ids in one query.
 * Returns a plain map; missing ids simply have no entry.
 */
export async function nameMap(
  admin: ReturnType<typeof createAdminClient>,
  userIds: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const ids = [...new Set(userIds.filter((v): v is string => Boolean(v)))];
  if (ids.length === 0) return {};
  const { data } = await admin
    .from("user_profiles")
    .select("user_id, full_name")
    .in("user_id", ids);
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.full_name) out[row.user_id as string] = row.full_name as string;
  }
  return out;
}

/**
 * The active sales_functions a user holds. Returns [] when the deployments
 * table is missing rather than throwing — /api/me must keep working for every
 * existing screen in a database that has not run 043 yet.
 */
export async function activeSalesFunctions(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<SalesFunction[]> {
  const { data, error } = await admin
    .from("rep_deployments")
    .select("sales_function")
    .eq("user_id", userId)
    .eq("is_active", true);
  if (error || !data) return [];
  return data.map((r) => r.sales_function as SalesFunction);
}
