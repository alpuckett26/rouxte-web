import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("ai_usage")
    .select("prompts_used, total_prompts_used")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  return NextResponse.json({
    prompts_used: data?.prompts_used ?? 0,
    total_prompts_used: data?.total_prompts_used ?? 0,
  });
}
