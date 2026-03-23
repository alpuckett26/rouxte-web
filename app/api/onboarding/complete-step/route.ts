import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OnboardingStep } from "@/lib/types";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { step, profile } = body as {
    step: OnboardingStep;
    profile?: {
      full_name: string;
      role: string;
      territory: string;
      carrier_focus: string;
    };
  };

  const admin = createAdminClient();

  if (step === "complete" && profile) {
    // 1. Check if user already has a profile (and therefore an org)
    const { data: existing } = await admin
      .from("user_profiles")
      .select("id, org_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let orgId: string;

    if (existing?.org_id) {
      orgId = existing.org_id;
    } else {
      // 2. Create a personal org for this user
      const orgName = profile.full_name?.trim() || user.email?.split("@")[0] || "My Org";
      const { data: newOrg, error: orgError } = await admin
        .from("orgs")
        .insert({ name: orgName })
        .select("id")
        .single();

      if (orgError || !newOrg) {
        return NextResponse.json(
          { error: `Failed to create org: ${orgError?.message}` },
          { status: 500 }
        );
      }
      orgId = newOrg.id;
    }

    // 3. Upsert user profile with the real org_id
    const { error: profileError } = await admin
      .from("user_profiles")
      .upsert(
        {
          user_id: user.id,
          org_id: orgId,
          full_name: profile.full_name,
          role: profile.role,
          territory: profile.territory || null,
          carrier_focus: profile.carrier_focus || null,
          onboarding_step: "complete",
          onboarding_complete: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,org_id" }
      );

    if (profileError) {
      return NextResponse.json(
        { error: `Failed to save profile: ${profileError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  // Advance onboarding step (not final)
  const stepOrder: OnboardingStep[] = ["verify", "promo", "profile", "complete"];
  if (!stepOrder.includes(step)) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }

  // Try update first; if no row exists yet, insert a stub
  const { data: existingProfile } = await admin
    .from("user_profiles")
    .select("id, org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingProfile) {
    await admin
      .from("user_profiles")
      .update({ onboarding_step: step, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
  } else {
    // Create org + stub profile so onboarding state can be tracked
    const { data: stubOrg } = await admin
      .from("orgs")
      .insert({ name: user.email?.split("@")[0] ?? "New Org" })
      .select("id")
      .single();

    if (stubOrg) {
      await admin.from("user_profiles").insert({
        user_id: user.id,
        org_id: stubOrg.id,
        onboarding_step: step,
      });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("onboarding_step, onboarding_complete")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ profile });
}
