import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DAILY_LIMIT = 3;
const TOTAL_LIMIT = 15;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("org_id, team_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const today = new Date().toISOString().split("T")[0];

  // Check / upsert usage
  const { data: usage } = await supabase
    .from("ai_usage")
    .select("id, prompts_used, total_prompts_used")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  const dailyUsed = usage?.prompts_used ?? 0;
  const totalUsed = usage?.total_prompts_used ?? 0;

  if (dailyUsed >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: "Daily AI limit reached (3/day). Upgrade your plan for more." },
      { status: 429 }
    );
  }

  if (totalUsed >= TOTAL_LIMIT) {
    return NextResponse.json(
      { error: "Total AI prompt cap reached (15). Contact your manager to increase." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { prompt_type, lead_id, prompt } = body;

  if (!prompt_type || !prompt) {
    return NextResponse.json({ error: "prompt_type and prompt are required" }, { status: 400 });
  }

  // TODO: wire to actual AI model (Claude API) — placeholder response for now
  const aiResponse = `[AI response placeholder for prompt type: ${prompt_type}]`;

  // Update usage counters
  if (usage) {
    await supabase
      .from("ai_usage")
      .update({
        prompts_used: dailyUsed + 1,
        total_prompts_used: totalUsed + 1,
      })
      .eq("id", usage.id);
  } else {
    await supabase.from("ai_usage").insert({
      org_id: profile.org_id,
      user_id: user.id,
      date: today,
      prompts_used: 1,
      total_prompts_used: totalUsed + 1,
    });
  }

  // Log prompt
  await supabase.from("ai_prompt_logs").insert({
    org_id: profile.org_id,
    user_id: user.id,
    lead_id: lead_id ?? null,
    prompt_type,
    tokens: 0, // update with real token count when AI is wired
  });

  return NextResponse.json({
    response: aiResponse,
    usage: { daily: dailyUsed + 1, daily_limit: DAILY_LIMIT, total: totalUsed + 1, total_limit: TOTAL_LIMIT },
  });
}
