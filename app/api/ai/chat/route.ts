import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperAdminEmail } from "@/lib/auth/super-admin";

const DAILY_LIMIT = 50;

// ── System prompts ─────────────────────────────────────────────────────────

const COACH_SYSTEM = (knowledge: string) => `You are Rex — a high-energy, no-BS door-to-door fiber sales coach with 10+ years in the field.
You've closed thousands of doors. You know every objection, every stall, every buying signal.
You whisper in your rep's earpiece — short, punchy, actionable. No fluff, no theory.

CRITICAL OUTPUT RULE — Rebuttals and scripts:
When giving a rebuttal, pitch, or anything the rep should SAY, write it as the rep's EXACT words in first person — as if the rep is speaking directly to the customer.
Do NOT say "you could say..." or "try saying..." — just write the script directly so they can read it out loud immediately.
Format multi-step responses as numbered steps, each with the exact words.
Sound natural and confident — like a real human, not a sales robot.

Other rules:
- Keep responses under 150 words unless asked for a full script
- When handling objections: acknowledge → reframe → close — write each step as exact dialogue
- Use the customer's situation to personalize
- If asked for a pitch: give it as a complete script they speak out loud
- You know every competitor's weaknesses cold

${knowledge ? `Your knowledge base — use it:\n\n${knowledge}` : ""}`;

const ROLEPLAY_SYSTEM = (knowledge: string, context: string) => `You are playing the role of a homeowner at ${context || "a door"}.
You are skeptical but not rude. You have a current internet provider you're "happy with."
Common responses you give: "I already have Spectrum", "I'm not interested", "I need to talk to my spouse", "How much does it cost?"
The sales rep is practicing their pitch on you. Stay in character as the homeowner.
Be realistic — push back naturally but be willing to be convinced if they make a great point.
After 3-4 exchanges, if they haven't closed, give a soft objection. If they've done well, show buying signals.
Never break character unless the rep says "stop roleplay" or "end practice".

${knowledge ? `Background (homeowner context): ${context}\n\n` : ""}`;

// ── Knowledge helpers ──────────────────────────────────────────────────────

async function buildKnowledge(orgId: string, admin: ReturnType<typeof createAdminClient>): Promise<string> {
  const [{ data: competitors }, { data: qa }] = await Promise.all([
    admin.from("competitor_intel")
      .select("competitor, plan_name, monthly_price, download_mbps, upload_mbps, contract_required, data_cap_gb, notes")
      .or(`org_id.is.null,org_id.eq.${orgId}`)
      .eq("active", true)
      .order("competitor"),
    admin.from("coach_qa")
      .select("trigger, response, category")
      .eq("org_id", orgId)
      .eq("active", true)
      .order("use_count", { ascending: false })
      .limit(30),
  ]);

  const parts: string[] = [];

  if (competitors?.length) {
    const lines = competitors.map((c) => {
      const bits = [`${c.competitor} — ${c.plan_name}: $${c.monthly_price}/mo`];
      if (c.download_mbps) bits.push(`${c.download_mbps}↓/${c.upload_mbps ?? "?"}↑ Mbps`);
      if (c.contract_required) bits.push("contract required");
      if (c.data_cap_gb) bits.push(`${c.data_cap_gb}GB cap`);
      else bits.push("no data cap");
      if (c.notes) bits.push(`(${c.notes})`);
      return bits.join(", ");
    });
    parts.push(`## COMPETITOR INTEL\n${lines.join("\n")}`);
  }

  if (qa?.length) {
    const grouped: Record<string, string[]> = {};
    for (const item of qa) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(`  Q: "${item.trigger}"\n  A: ${item.response}`);
    }
    const qaLines = Object.entries(grouped).map(([cat, items]) =>
      `### ${cat.toUpperCase()}\n${items.join("\n\n")}`
    );
    parts.push(`## PROVEN SCRIPTS & REBUTTALS\n${qaLines.join("\n\n")}`);
  }

  return parts.join("\n\n---\n\n");
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return new Response(JSON.stringify({ error: "Profile not found" }), { status: 400 });

  // Rate limiting — managers/admins/super-admins exempt
  const isManager = ["admin", "sales_manager", "team_lead"].includes(profile.role);
  const isSuperAdmin = isSuperAdminEmail(user.email);
  if (!isManager && !isSuperAdmin) {
    const today = new Date().toISOString().split("T")[0];
    const { data: usage } = await admin.from("ai_usage")
      .select("prompts_used")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();
    if ((usage?.prompts_used ?? 0) >= DAILY_LIMIT) {
      return new Response(JSON.stringify({ error: `Daily limit reached (${DAILY_LIMIT}/day). Resets at midnight.`, code: "daily_limit" }), { status: 429 });
    }
  }

  const body = await request.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
    mode: "coach" | "roleplay";
    lead_context?: {
      address?: string;
      status?: string;
      att_available?: boolean;
      customer_name?: string | null;
    };
  };

  const { messages, mode, lead_context } = body;
  if (!messages?.length) return new Response(JSON.stringify({ error: "No messages" }), { status: 400 });

  // Build knowledge base and system prompt
  const knowledge = await buildKnowledge(profile.org_id, admin);

  let contextStr = "";
  if (lead_context) {
    const parts = [];
    if (lead_context.address) parts.push(`Address: ${lead_context.address}`);
    if (lead_context.customer_name) parts.push(`Customer: ${lead_context.customer_name}`);
    if (lead_context.status) parts.push(`Lead status: ${lead_context.status}`);
    if (lead_context.att_available !== undefined) parts.push(`Service available: ${lead_context.att_available ? "YES" : "NO"}`);
    contextStr = parts.join(" | ");
  }

  const systemPrompt = mode === "roleplay"
    ? ROLEPLAY_SYSTEM(knowledge, contextStr)
    : COACH_SYSTEM(knowledge) + (contextStr ? `\n\nCurrent lead context: ${contextStr}` : "");

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Increment usage
  if (!isManager && !isSuperAdmin) {
    const today = new Date().toISOString().split("T")[0];
    const { data: usage } = await admin.from("ai_usage").select("id, prompts_used, total_prompts_used").eq("user_id", user.id).eq("date", today).maybeSingle();
    if (usage) {
      await admin.from("ai_usage").update({ prompts_used: usage.prompts_used + 1, total_prompts_used: usage.total_prompts_used + 1 }).eq("id", usage.id);
    } else {
      await admin.from("ai_usage").insert({ org_id: profile.org_id, user_id: user.id, date: today, prompts_used: 1, total_prompts_used: 1 });
    }
  }

  // Stream response
  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: systemPrompt,
    messages: messages.slice(-12), // keep last 12 messages for context window
  });

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text));
          }
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
    },
  });
}
