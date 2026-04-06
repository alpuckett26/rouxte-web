import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DAILY_LIMIT = 20;
const TOTAL_LIMIT = 200;

// Which training docs are most relevant per prompt type (by title keywords)
const PROMPT_DOC_KEYWORDS: Record<string, string[]> = {
  objection:   ["rebuttal", "att rebuttal", "think about it", "no time", "cable vs fiber", "price comparison", "fiber vs 5g", "fomo"],
  pitch:       ["d2d psych", "fomo", "concept yes", "behavior", "fiber pros", "indepth pros", "closing"],
  followup:    ["behavior", "customer cues", "closing", "think about it", "no time"],
  next_action: ["customer cues", "behavior", "closing", "rebuttal"],
};

async function getKnowledgeContext(promptType: string, orgId: string, adminClient: ReturnType<typeof createAdminClient>): Promise<string> {
  const [trainingCtx, competitorCtx, qaCtx] = await Promise.all([
    getTrainingContext(promptType, adminClient),
    getCompetitorContext(adminClient, orgId),
    getQAContext(promptType, adminClient, orgId),
  ]);

  const parts: string[] = [];
  if (trainingCtx) parts.push(`# TRAINING MATERIAL\n${trainingCtx}`);
  if (competitorCtx) parts.push(`# COMPETITOR PRICING INTEL\n${competitorCtx}`);
  if (qaCtx) parts.push(`# MANAGER-APPROVED SCRIPTS & RESPONSES\n${qaCtx}`);
  return parts.join("\n\n---\n\n");
}

async function getCompetitorContext(adminClient: ReturnType<typeof createAdminClient>, orgId: string): Promise<string> {
  const { data } = await adminClient
    .from("competitor_intel")
    .select("competitor, plan_name, monthly_price, download_mbps, upload_mbps, contract_required, data_cap_gb, notes")
    .or(`org_id.is.null,org_id.eq.${orgId}`)
    .eq("active", true)
    .order("competitor");

  if (!data?.length) return "";

  const lines = data.map((c) => {
    const parts = [`${c.competitor} — ${c.plan_name}: $${c.monthly_price}/mo`];
    if (c.download_mbps) parts.push(`${c.download_mbps}/${c.upload_mbps ?? "?"}Mbps`);
    if (c.contract_required) parts.push("requires contract");
    if (c.data_cap_gb) parts.push(`${c.data_cap_gb}GB cap`);
    if (c.notes) parts.push(`(${c.notes})`);
    return parts.join(", ");
  });
  return lines.join("\n");
}

async function getQAContext(promptType: string, adminClient: ReturnType<typeof createAdminClient>, orgId: string): Promise<string> {
  const categoryMap: Record<string, string[]> = {
    objection:   ["objection", "rebuttal"],
    pitch:       ["pitch", "opening"],
    followup:    ["closing", "followup"],
    next_action: ["closing", "objection"],
  };
  const categories = categoryMap[promptType] ?? ["objection"];

  const { data } = await adminClient
    .from("coach_qa")
    .select("trigger, response, category")
    .eq("org_id", orgId)
    .eq("active", true)
    .in("category", categories)
    .order("use_count", { ascending: false })
    .limit(10);

  if (!data?.length) return "";

  return data.map((qa) => `[${qa.category}] When a prospect says: "${qa.trigger}"\nResponse: ${qa.response}`).join("\n\n");
}

async function getTrainingContext(promptType: string, adminClient: ReturnType<typeof createAdminClient>): Promise<string> {
  const keywords = PROMPT_DOC_KEYWORDS[promptType] ?? [];

  const { data: docs } = await adminClient
    .from("training_documents")
    .select("title, content, folder")
    .eq("folder", "training")
    .order("sequence_order");

  if (!docs?.length) return "";

  // Filter to relevant docs, fall back to product knowledge if no match
  const relevant = docs.filter((d) =>
    keywords.some((k) => d.title.toLowerCase().includes(k.toLowerCase()))
  );
  const productKnowledge = docs.filter((d) =>
    ["fiber pros", "indepth pros", "cable vs fiber", "fiber vs 5g", "latency", "price comparison"].some((k) =>
      d.title.toLowerCase().includes(k.toLowerCase())
    )
  );

  const selected = relevant.length > 0
    ? [...new Set([...relevant, ...productKnowledge])]
    : productKnowledge;

  if (!selected.length) return "";

  return selected
    .map((d) => `## ${d.title}\n${d.content.slice(0, 1500)}`)
    .join("\n\n---\n\n");
}

const BASE_SYSTEM = `You are an expert field sales coach for AT&T fiber internet door-to-door sales reps.
You give short, practical, conversational responses — no bullet-point essays.
Keep answers under 150 words unless asked for a script. Be direct and actionable.
You know the FCC broadband landscape, common objections to switching ISPs, and what makes fiber a compelling upgrade.
When you give rebuttals or pitches, use the exact language and techniques from the training material provided.`;

const PROMPT_TEMPLATES: Record<string, (ctx: PromptContext) => string> = {
  objection: ({ objection, address, att_available }) =>
    `A homeowner at ${address ?? "this address"} said: "${objection}". ${att_available ? "AT&T fiber IS available here." : "AT&T fiber is NOT available here."} Give me a concise, natural rebuttal I can say at the door right now.`,

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
    return NextResponse.json({ error: `Daily limit reached (${DAILY_LIMIT}/day). Resets at midnight.`, code: "daily_limit" }, { status: 429 });
  }
  if (totalUsed >= TOTAL_LIMIT) {
    return NextResponse.json({ error: `Total AI cap reached (${TOTAL_LIMIT}). Ask your manager to increase your tier.`, code: "total_limit" }, { status: 429 });
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

  // Build system prompt with training content, competitor intel, and Q&A bank
  const knowledgeContext = await getKnowledgeContext(prompt_type, profile.org_id, admin);
  const systemPrompt = knowledgeContext
    ? `${BASE_SYSTEM}\n\nUse the following knowledge base to inform your responses:\n\n${knowledgeContext}`
    : BASE_SYSTEM;

  const userMessage = PROMPT_TEMPLATES[prompt_type](context);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let responseText = "";
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 350,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });
    responseText = message.content.filter((b) => b.type === "text").map((b) => (b as { type: "text"; text: string }).text).join("");
    inputTokens = message.usage.input_tokens;
    outputTokens = message.usage.output_tokens;
  } catch {
    return NextResponse.json({ error: "AI service unavailable. Try again shortly." }, { status: 503 });
  }

  // Update usage
  if (usage) {
    await admin.from("ai_usage").update({ prompts_used: dailyUsed + 1, total_prompts_used: totalUsed + 1 }).eq("id", usage.id);
  } else {
    await admin.from("ai_usage").insert({ org_id: profile.org_id, user_id: user.id, date: today, prompts_used: 1, total_prompts_used: totalUsed + 1 });
  }
  await admin.from("ai_prompt_logs").insert({ org_id: profile.org_id, user_id: user.id, lead_id: lead_id ?? null, prompt_type, tokens: inputTokens + outputTokens });

  return NextResponse.json({
    response: responseText,
    usage: { daily: dailyUsed + 1, daily_limit: DAILY_LIMIT, total: totalUsed + 1, total_limit: TOTAL_LIMIT },
  });
}
