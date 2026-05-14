import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { isSuperAdminEmail } from "./super-admin";

/**
 * Guard helper for /api/admin/* routes. Returns null if the caller is a
 * super-admin, or a NextResponse 401/403 to short-circuit otherwise.
 *
 * Use like:
 *   const guard = await requireSuperAdmin();
 *   if (guard) return guard;
 */
export async function requireSuperAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdminEmail(user.email)) {
    return NextResponse.json({ error: "Super-admin only" }, { status: 403 });
  }
  return null;
}
