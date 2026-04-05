import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, full_name, org_id, team_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    user_id: user.id,
    email: user.email,
    role: profile?.role ?? "sales_rep",
    full_name: profile?.full_name ?? null,
    org_id: profile?.org_id ?? null,
    team_id: profile?.team_id ?? null,
  });
}
