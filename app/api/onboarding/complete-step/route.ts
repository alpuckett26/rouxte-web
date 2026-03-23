import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

  if (step === "complete" && profile) {
    // Upsert full profile and mark onboarding complete
    const { error } = await supabase
      .from("user_profiles")
      .upsert({
        user_id: user.id,
        full_name: profile.full_name,
        role: profile.role,
        territory: profile.territory || null,
        carrier_focus: profile.carrier_focus || null,
        onboarding_step: "complete",
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,org_id" });

    if (error) {
      // profile might not have org_id yet — insert fresh
      const { error: insertError } = await supabase
        .from("user_profiles")
        .insert({
          user_id: user.id,
          org_id: user.id, // placeholder: real org provisioning flow goes here
          full_name: profile.full_name,
          role: profile.role,
          territory: profile.territory || null,
          carrier_focus: profile.carrier_focus || null,
          onboarding_step: "complete",
          onboarding_complete: true,
        });

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }
  } else {
    // Just advance the onboarding step
    const stepOrder: OnboardingStep[] = ["verify", "promo", "profile", "complete"];
    if (!stepOrder.includes(step)) {
      return NextResponse.json({ error: "Invalid step" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_profiles")
      .update({ onboarding_step: step, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    if (error) {
      // Row might not exist yet on first call
      await supabase.from("user_profiles").insert({
        user_id: user.id,
        org_id: user.id, // placeholder
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
