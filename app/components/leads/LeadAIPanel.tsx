"use client";

import { useState } from "react";
import { Lead } from "@/lib/types";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

type PromptType = "objection" | "pitch" | "followup" | "next_action";

interface Props {
  lead: Lead;
  lastNote?: string;
}

const PROMPT_TYPES: { type: PromptType; label: string; icon: string; placeholder?: string }[] = [
  { type: "next_action", label: "Next Best Action", icon: "→", },
  { type: "pitch", label: "Door Pitch", icon: "🗣", },
  { type: "objection", label: "Handle Objection", icon: "💬", placeholder: "e.g. I already have Spectrum..." },
  { type: "followup", label: "Follow-up Text", icon: "📱", },
];

interface UsageInfo {
  daily: number;
  daily_limit: number;
  total: number;
  total_limit: number;
}

export default function LeadAIPanel({ lead, lastNote }: Props) {
  const [activeType, setActiveType] = useState<PromptType>("next_action");
  const [objection, setObjection] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [copied, setCopied] = useState(false);

  const activeConfig = PROMPT_TYPES.find((p) => p.type === activeType)!;

  async function generate() {
    if (activeType === "objection" && !objection.trim()) return;
    setLoading(true);
    setError("");
    setResponse("");

    const context = {
      address: lead.address,
      att_available: lead.carrier_availability?.att ?? false,
      competitors: lead.carrier_availability?.competitors ?? [],
      current_status: lead.status,
      objection: objection || undefined,
      last_note: lastNote || undefined,
    };

    try {
      const res = await fetch("/api/ai/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_type: activeType, lead_id: lead.id, context }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      setResponse(data.response);
      setUsage(data.usage);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function copyResponse() {
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const dailyRemaining = usage ? usage.daily_limit - usage.daily : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Prompt type selector */}
      <div className="grid grid-cols-2 gap-2">
        {PROMPT_TYPES.map((p) => (
          <button
            key={p.type}
            onClick={() => { setActiveType(p.type); setResponse(""); setError(""); }}
            className={`rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
              activeType === p.type
                ? "border-blue-400 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span className="mr-1.5">{p.icon}</span>
            {p.label}
          </button>
        ))}
      </div>

      {/* Context card */}
      <Card padding="sm">
        <p className="text-xs text-gray-500 mb-1.5">Lead context</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
          <span><span className="text-gray-400">Address:</span> {lead.address}</span>
          <span>
            <span className="text-gray-400">AT&T:</span>{" "}
            <span className={lead.carrier_availability?.att ? "text-green-600 font-medium" : "text-gray-500"}>
              {lead.carrier_availability?.att ? "Available" : "Not available"}
            </span>
          </span>
          <span><span className="text-gray-400">Status:</span> {lead.status.replace("_", " ")}</span>
        </div>
      </Card>

      {/* Objection input */}
      {activeType === "objection" && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">What did they say?</label>
          <textarea
            value={objection}
            onChange={(e) => setObjection(e.target.value)}
            placeholder={activeConfig.placeholder}
            rows={2}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
          />
        </div>
      )}

      {/* Generate button */}
      <Button
        onClick={generate}
        loading={loading}
        disabled={activeType === "objection" && !objection.trim()}
        className="w-full"
      >
        {loading ? "Generating…" : `Generate ${activeConfig.label}`}
      </Button>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Response */}
      {response && (
        <div className="flex flex-col gap-2">
          <div className="relative rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{response}</p>
          </div>
          <button
            onClick={copyResponse}
            className="self-end flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
          >
            {copied ? (
              <><span className="text-green-600">✓</span> Copied</>
            ) : (
              <><span>⎘</span> Copy</>
            )}
          </button>
        </div>
      )}

      {/* Usage meter */}
      {usage && (
        <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-gray-500">Daily AI usage</p>
            <p className="text-xs font-medium text-gray-700">
              {usage.daily}/{usage.daily_limit} today
              {dailyRemaining !== null && dailyRemaining <= 1 && (
                <span className="text-orange-500 ml-1">· {dailyRemaining} left</span>
              )}
            </p>
          </div>
          <div className="h-1.5 rounded-full bg-gray-200">
            <div
              className={`h-1.5 rounded-full transition-all ${
                usage.daily >= usage.daily_limit ? "bg-red-500" : "bg-blue-500"
              }`}
              style={{ width: `${Math.min((usage.daily / usage.daily_limit) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {usage.total}/{usage.total_limit} total cap · Team tier unlocks more
          </p>
        </div>
      )}
    </div>
  );
}
