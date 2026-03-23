import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DAILY_LIMIT = 3;
const TOTAL_LIMIT = 15;

const SYSTEM_PROMPT = `You are an expert field sales coach for AT&T fiber internet door-to-door sales reps.
You give short, practical, conversational responses — no bullet-point essays.
Keep answers under 150 words unless asked for a script. Be direct and actionable.
You know the FCC broadband landscape, common objections to switching ISPs, and what makes fiber a compelling upgrade.`;

const PROMPT_TEMPLATES: Record<string, (ctx: PromptContext) => string> = {
  objection: ({ objection, address, att_available }) =>
    `A homeowner at ${address ?? "this address"} said: "${objection}". ${att_available ? "AT&T fiber IS available here." : "AT&T fiber is NOT available here."} Give me a concise, natural rebuttal I can say at the door.`,

  pitch: ({ address, att_available, competitors, current_status }) =>
    `Write a 30-second door pitch for ${address ?? "this address"}. ${att_available ? `AT&T fiber is available. Competitors: ${competitors?.join(", ") || "unknown"}.` : "AT&T fiber is not yet available — focus on getting contact info for when it is."} Lead status: ${current_status ?? "new"}.`,

  followup: ({ address, last_note, current_status }) =>
    `Write a short follow-up text message for a prospect at ${address ?? "this address"}. Status: ${current_status ?? "contacted"}. ${last_note ? `Last note: "${last_note}"` : ""} Keep it under 2 sentences, friendly, not pushy.`,

  next_action: ({ address, current_status, att_available, last_note }) =>
    `What's the single best next action for this lead? Address: ${address ?? "unknown"}. Status: ${current_status ?? "new"}. AT&T available: ${att_available ? "yes" : "no"}. ${last_note ? `Last note: "${last_note}"` : ""} One sentence answer.`,
};

interface PromptContext {
  address?: string;
  att_available?: boolean;
  competitors?: string[];
  current_status?: string;
  objection?: string;
  last_note?: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id, team_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const today = new Date().toISOString().split("T")[0];

  const { data: usage } = await admin
    .from("ai_usage")
    .select("id, prompts_used, total_prompts_used")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  const dailyUsed = usage?.prompts_used ?? 0;
  const totalUsed = usage?.total_prompts_used ?? 0;

  if (dailyUsed >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: `Daily limit reached (${DAILY_LIMIT}/day). Resets at midnight.`, code: "daily_limit" },
      { status: 429 }
    );
  }
  if (totalUsed >= TOTAL_LIMIT) {
    return NextResponse.json(
      { error: `Total AI cap reached (${TOTAL_LIMIT}). Ask your manager to increase your tier.`, code: "total_limit" },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { prompt_type, lead_id, context } = body as {
    prompt_type: keyof typeof PROMPT_TEMPLATES;
    lead_id?: string;
    context: PromptContext;
  };

  if (!prompt_type || !PROMPT_TEMPLATES[prompt_type]) {
    return NextResponse.json({ error: "Invalid prompt_type" }, { status: 400 });
  }

  const userMessage = PROMPT_TEMPLATES[prompt_type](context);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let responseText = "";
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    responseText = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");
    inputTokens = message.usage.input_tokens;
    outputTokens = message.usage.output_tokens;
  } catch (err) {
    return NextResponse.json(
      { error: "AI service unavailable. Try again shortly." },
      { status: 503 }
    );
  }

  // Update usage counters
  if (usage) {
    await admin
      .from("ai_usage")
      .update({ prompts_used: dailyUsed + 1, total_prompts_used: totalUsed + 1 })
      .eq("id", usage.id);
  } else {
    await admin.from("ai_usage").insert({
      org_id: profile.org_id,
      user_id: user.id,
      date: today,
      prompts_used: 1,
      total_prompts_used: totalUsed + 1,
    });
  }

  await admin.from("ai_prompt_logs").insert({
    org_id: profile.org_id,
    user_id: user.id,
    lead_id: lead_id ?? null,
    prompt_type,
    tokens: inputTokens + outputTokens,
  });

  return NextResponse.json({
    response: responseText,
    usage: {
      daily: dailyUsed + 1,
      daily_limit: DAILY_LIMIT,
      total: totalUsed + 1,
      total_limit: TOTAL_LIMIT,
    },
  });
}
