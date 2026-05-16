import type { SupabaseClient } from "@supabase/supabase-js";
import { isSuperAdminEmail } from "./super-admin";

/**
 * Canonical "who is this viewer allowed to see leads/activity for?" helper.
 * Single source of truth — every API route that returns lead-scoped data
 * should consult this rather than re-implementing role checks.
 *
 * Returns a scope (`self` / `team` / `org`) plus the explicit list of user_ids
 * the viewer can see and the team_ids those users belong to.
 *
 *   sales_rep     → scope=self, userIds=[viewer]
 *   team_lead     → scope=team, userIds=[viewer + every team_member of every
 *                                        team the viewer is in]
 *   sales_manager → scope=org,  userIds=every user_profiles row in the org
 *   admin         → scope=org,  userIds=every user_profiles row in the org
 *   super-admin   → scope=org,  userIds=every user_profiles row in the org
 *                                       (orgId can be overridden via param)
 */

export type Scope = "self" | "team" | "org";

export interface VisibleScope {
  scope: Scope;
  userIds: string[];
  teamIds: string[];
  orgId: string;
}

interface ViewerContext {
  user_id: string;
  email: string | null;
  org_id: string;
  team_id: string | null;
  role: "admin" | "sales_manager" | "team_lead" | "sales_rep";
}

/**
 * @param admin  service-role supabase client (so we can read all teams/members
 *               regardless of RLS)
 * @param viewer the calling user's identity + role
 * @param overrideOrgId for super-admin impersonation only
 */
export async function getVisibleRepIds(
  admin: SupabaseClient,
  viewer: ViewerContext,
  overrideOrgId?: string,
): Promise<VisibleScope> {
  const isSuper = isSuperAdminEmail(viewer.email);
  const effectiveOrgId = (isSuper && overrideOrgId) ? overrideOrgId : viewer.org_id;

  // Org-level scope for admins / managers / super-admin
  if (isSuper || viewer.role === "admin" || viewer.role === "sales_manager") {
    const { data: profiles } = await admin
      .from("user_profiles")
      .select("user_id, team_id")
      .eq("org_id", effectiveOrgId);
    const userIds = (profiles ?? []).map((p) => p.user_id);
    const teamIds = [...new Set((profiles ?? []).map((p) => p.team_id).filter(Boolean))] as string[];
    return { scope: "org", userIds, teamIds, orgId: effectiveOrgId };
  }

  // Team scope for team leads
  if (viewer.role === "team_lead") {
    // Every team this viewer belongs to
    const { data: myTeams } = await admin
      .from("team_members")
      .select("team_id")
      .eq("user_id", viewer.user_id);
    const teamIds = [...new Set((myTeams ?? []).map((t) => t.team_id))];
    if (teamIds.length === 0) {
      // Team lead with no team yet — fall back to self only
      return { scope: "self", userIds: [viewer.user_id], teamIds: [], orgId: effectiveOrgId };
    }
    const { data: members } = await admin
      .from("team_members")
      .select("user_id")
      .in("team_id", teamIds);
    const userIds = [...new Set([viewer.user_id, ...((members ?? []).map((m) => m.user_id))])];
    return { scope: "team", userIds, teamIds, orgId: effectiveOrgId };
  }

  // Sales rep: self only
  return { scope: "self", userIds: [viewer.user_id], teamIds: [], orgId: effectiveOrgId };
}

/**
 * Convenience guard: returns true if `viewer` is allowed to see the leads
 * assigned to / created by `targetUserId`.
 */
export async function canViewerSeeUser(
  admin: SupabaseClient,
  viewer: ViewerContext,
  targetUserId: string,
  overrideOrgId?: string,
): Promise<boolean> {
  const scope = await getVisibleRepIds(admin, viewer, overrideOrgId);
  return scope.userIds.includes(targetUserId);
}
