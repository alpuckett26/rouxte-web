import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, FROM } from "@/lib/email/resend";
import { terminationEmail } from "@/lib/email/templates";

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

  if (body.role !== undefined) {
    const allowedRoles = ["sales_rep", "team_lead", "sales_manager"];
    // Only admins can promote to admin; sales_managers cannot self-escalate
    if (body.role === "admin" && callerProfile.role !== "admin") {
      return NextResponse.json({ error: "Only admins can assign the admin role" }, { status: 403 });
    }
    if (!["sales_rep", "team_lead", "sales_manager", "admin"].includes(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    // sales_manager cannot demote/promote other sales_managers or admins
    if (callerProfile.role === "sales_manager" && !allowedRoles.includes(targetProfile.role)) {
      return NextResponse.json({ error: "Insufficient permissions to modify this user's role" }, { status: 403 });
    }
    updates.role = body.role;
  }

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

// DELETE /api/manager/members/[userId] — terminate a team member
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { userId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: callerProfile } = await admin
    .from("user_profiles")
    .select("org_id, role, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!callerProfile || !["admin", "sales_manager"].includes(callerProfile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: targetProfile } = await admin
    .from("user_profiles")
    .select("id, role, team_id, full_name")
    .eq("user_id", userId)
    .eq("org_id", callerProfile.org_id)
    .maybeSingle();

  if (!targetProfile) {
    return NextResponse.json({ error: "User not found in org" }, { status: 404 });
  }
  if (targetProfile.role === "admin") {
    return NextResponse.json({ error: "Cannot terminate an admin" }, { status: 403 });
  }
  if (targetProfile.role === "sales_manager" && callerProfile.role !== "admin") {
    return NextResponse.json({ error: "Only admins can terminate managers" }, { status: 403 });
  }

  // Get email from auth before any changes
  const { data: authData } = await admin.auth.admin.getUserById(userId);
  const email = authData?.user?.email;

  // Mark terminated and clear team
  await admin
    .from("user_profiles")
    .update({ terminated_at: new Date().toISOString(), terminated_by: user.id, team_id: null })
    .eq("user_id", userId)
    .eq("org_id", callerProfile.org_id);

  // Remove from team_members
  await admin.from("team_members").delete().eq("user_id", userId);

  // Send termination email (best-effort)
  if (email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://rouxte.com";
    const { data: org } = await admin.from("orgs").select("name").eq("id", callerProfile.org_id).single();
    const { subject, html } = terminationEmail({
      repName: targetProfile.full_name,
      orgName: org?.name ?? "your company",
      managerName: (callerProfile as { full_name?: string }).full_name ?? "Your Manager",
      payUrl: `${appUrl}/payroll`,
    });
    await sendEmail({ from: FROM, to: email, subject, html });
  }

  return NextResponse.json({ success: true });
}
