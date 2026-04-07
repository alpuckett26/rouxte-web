"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface LeadContext {
  address?: string;
  status?: string;
  att_available?: boolean;
  customer_name?: string | null;
}

interface Props {
  leadContext?: LeadContext;
  compact?: boolean; // true = embedded in lead panel, false = full page
}

// Quick scenario chips — one tap starts the conversation
const SCENARIOS = [
  { label: "Price objection", prompt: "They said the price is too high. What do I say?" },
  { label: "Has Spectrum", prompt: "They say they already have Spectrum and are happy with it. How do I handle that?" },
  { label: "Not interested", prompt: "They said they're not interested right at the door. What's my move?" },
  { label: "Think about it", prompt: "They want to think about it. How do I close without being pushy?" },
  { label: "Already have fiber", prompt: "They say they already have fiber internet. How do I still make the pitch?" },
  { label: "Give me a pitch", prompt: "Give me a strong 30-second door pitch to open with." },
  { label: "Appointment close", prompt: "How do I set an appointment when they won't commit on the spot?" },
  { label: "Spouse objection", prompt: "They say they need to talk to their spouse first. What do I say?" },
];

export default function AiCoachChat({ leadContext, compact = false }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"coach" | "roleplay">("coach");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (userText: string) => {
    if (!userText.trim() || streaming) return;
    setError(null);

    const userMsg: Message = { role: "user", content: userText.trim() };
    const assistantMsg: Message = { role: "assistant", content: "", streaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          mode,
          lead_context: leadContext,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessages((prev) => prev.slice(0, -1)); // remove empty assistant msg
        setError(data.error ?? "Something went wrong.");
        setStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: accumulated, streaming: true };
          return updated;
        });
      }

      // Mark streaming done
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: accumulated, streaming: false };
        return updated;
      });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) => prev.slice(0, -1));
        setError("Network error. Try again.");
      }
    } finally {
      setStreaming(false);
    }
  }, [messages, mode, leadContext, streaming]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function startRoleplay() {
    setMode("roleplay");
    setMessages([]);
    send("Start the roleplay — you're the homeowner. I'll knock in 3 seconds.");
  }

  function reset() {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setMode("coach");
  }

  const isEmpty = messages.length === 0;

  return (
    <div className={`flex flex-col ${compact ? "h-[500px]" : "h-full min-h-[600px]"} bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${mode === "roleplay" ? "bg-orange-400 animate-pulse" : "bg-green-400"}`} />
          <span className="text-sm font-semibold text-gray-900">
            {mode === "roleplay" ? "Practice Mode" : "Rex — AI Coach"}
          </span>
          {leadContext?.address && (
            <span className="text-xs text-gray-400 truncate max-w-[160px]">{leadContext.address}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {mode === "roleplay" ? (
            <button
              onClick={reset}
              className="text-xs text-orange-600 font-medium px-2 py-1 rounded-lg hover:bg-orange-50 transition-colors"
            >
              End Practice
            </button>
          ) : (
            <button
              onClick={startRoleplay}
              className="text-xs text-purple-600 font-medium px-2 py-1 rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-1"
            >
              <span>Practice Mode</span>
            </button>
          )}
          {messages.length > 0 && (
            <button onClick={reset} className="text-xs text-gray-400 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Lead context bar */}
      {leadContext && (
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs shrink-0">
          {leadContext.customer_name && <span className="font-medium text-gray-700">{leadContext.customer_name}</span>}
          {leadContext.status && <span className="text-gray-500 capitalize">{leadContext.status.replace("_", " ")}</span>}
          {leadContext.att_available !== undefined && (
            <span className={leadContext.att_available ? "text-green-600 font-medium" : "text-gray-400"}>
              {leadContext.att_available ? "Service available" : "Not yet serviceable"}
            </span>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {isEmpty ? (
          <div className="flex flex-col gap-4 my-auto">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-3">
                <span className="text-white text-lg font-bold">R</span>
              </div>
              <p className="font-semibold text-gray-800">Rex is ready</p>
              <p className="text-sm text-gray-400 mt-1">Ask anything or pick a scenario below</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {SCENARIOS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => send(s.prompt)}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 font-medium hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors shadow-sm"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mr-2 mt-0.5 shrink-0">
                    <span className="text-white text-xs font-bold">R</span>
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : mode === "roleplay"
                      ? "bg-orange-50 text-gray-800 border border-orange-100 rounded-bl-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                  {msg.streaming && (
                    <span className="inline-block w-1 h-3.5 bg-current ml-0.5 animate-pulse rounded-sm" />
                  )}
                </div>
              </div>
            ))}

            {/* Quick follow-up chips after last assistant message */}
            {!streaming && messages[messages.length - 1]?.role === "assistant" && mode === "coach" && (
              <div className="flex flex-wrap gap-1.5 ml-8">
                {["Give me the exact words", "What if they push back?", "How do I close from here?"].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => send(chip)}
                    className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700 text-center">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 px-3 py-3 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            rows={1}
            placeholder={mode === "roleplay" ? "Respond to the customer..." : "Ask Rex anything..."}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 max-h-24 overflow-y-auto"
            style={{ minHeight: "40px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 96) + "px";
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || streaming}
            className="shrink-0 w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {streaming ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
        {!compact && (
          <p className="text-xs text-gray-400 mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
        )}
      </div>
    </div>
  );
}
