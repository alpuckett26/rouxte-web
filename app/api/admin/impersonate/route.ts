import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";

const DEMO_PASSWORD = "rouxte-demo";

export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if (guard) return guard;

  const orgId = req.nextUrl.searchParams.get("org_id");
  if (!orgId) {
    return NextResponse.json({ error: "Missing org_id" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: org, error: orgErr } = await admin
    .from("orgs")
    .select("id, name")
    .eq("id", orgId)
    .single();
  if (orgErr || !org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  // Hard gate: only demo orgs can be opened this way. Any future general
  // impersonation needs a separate, audited mechanism.
  if (!org.name?.startsWith("[DEMO")) {
    return NextResponse.json(
      { error: "Impersonate only allowed for demo orgs" },
      { status: 403 },
    );
  }

  const { data: profile, error: profErr } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("org_id", org.id)
    .eq("role", "admin")
    .limit(1)
    .single();
  if (profErr || !profile) {
    return NextResponse.json({ error: "No admin user found for org" }, { status: 404 });
  }

  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(
    profile.user_id,
  );
  if (authErr || !authUser?.user?.email) {
    return NextResponse.json({ error: "Admin user has no email" }, { status: 500 });
  }

  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: authUser.user.email,
    password: DEMO_PASSWORD,
  });
  if (signInErr) {
    return NextResponse.json(
      { error: "Sign-in failed. Has the demo seed run?" },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, redirect: "/dashboard" });
}
