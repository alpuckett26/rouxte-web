import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Params { params: Promise<{ userId: string }> }

// PATCH /api/manager/members/[userId] — update role and/or team for an org member
export async function PATCH(request: NextRequest, { params }: Params) {
  const { userId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: callerProfile } = await admin
    .from("user_profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!callerProfile || !["admin", "sales_manager"].includes(callerProfile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Ensure target user is in same org
  const { data: targetProfile } = await admin
    .from("user_profiles")
    .select("id, role, team_id")
    .eq("user_id", userId)
    .eq("org_id", callerProfile.org_id)
    .maybeSingle();

  if (!targetProfile) {
    return NextResponse.json({ error: "User not found in org" }, { status: 404 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.role !== undefined) updates.role = body.role;
  if (body.team_id !== undefined) updates.team_id = body.team_id || null;
  if (body.sales_tier_id !== undefined) updates.sales_tier_id = body.sales_tier_id || null;
  if (body.standing !== undefined) updates.standing = body.standing;

  const { data, error } = await admin
    .from("user_profiles")
    .update(updates)
    .eq("user_id", userId)
    .eq("org_id", callerProfile.org_id)
    .select("user_id, full_name, role, team_id, sales_tier_id, standing")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Keep team_members in sync
  if (body.team_id !== undefined) {
    if (body.team_id) {
      await admin.from("team_members").upsert(
        { team_id: body.team_id, user_id: userId, role: data.role },
        { onConflict: "team_id,user_id" }
      );
    } else if (targetProfile.team_id) {
      await admin
        .from("team_members")
        .delete()
        .eq("team_id", targetProfile.team_id)
        .eq("user_id", userId);
    }
  }

  return NextResponse.json({ data });
}
