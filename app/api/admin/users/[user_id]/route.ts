import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import type { UserRole } from "@/lib/types";

const VALID_ROLES: UserRole[] = ["admin", "sales_manager", "team_lead", "sales_rep"];

/**
 * PATCH /api/admin/users/[user_id]
 * Super-admin only. Mutates fields on user_profiles.
 *
 * Body (any subset):
 *   { role: UserRole }
 *
 * Bypasses RLS via the admin client because RLS would otherwise scope
 * the super-admin to their own org. The requireSuperAdmin() guard is
 * the only authorization layer.
 */
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ user_id: string }> },
) {
  const guard = await requireSuperAdmin();
  if (guard) return guard;

  const { user_id } = await ctx.params;

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const updates: Record<string, unknown> = {};

  if (typeof body.role === "string") {
    if (!VALID_ROLES.includes(body.role as UserRole)) {
      return NextResponse.json({ error: `Invalid role: ${body.role}` }, { status: 400 });
    }
    updates.role = body.role;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No mutable fields in request body" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_profiles")
    .update(updates)
    .eq("user_id", user_id)
    .select("user_id, role, full_name, org_id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "User profile not found" }, { status: 404 });

  return NextResponse.json({ ok: true, data });
}
