import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Server component: reads onboarding_step and redirects to the right screen
export default async function OnboardingCheckPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("onboarding_step, onboarding_complete")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    // First time: create a stub profile then send to confirmed popup
    redirect("/onboarding/confirmed");
  }

  if (profile.onboarding_complete) {
    redirect("/dashboard");
  }

  switch (profile.onboarding_step) {
    case "verify":
      redirect("/onboarding/confirmed");
    case "promo":
      redirect("/onboarding/promo");
    case "profile":
      redirect("/onboarding/profile");
    default:
      redirect("/dashboard");
  }
}
