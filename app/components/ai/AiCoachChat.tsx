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
  compact?: boolean;
}


const SCENARIOS = [
  { label: "Price objection",   prompt: "They said the price is too high. Give me the exact words to say." },
  { label: "Has Spectrum",      prompt: "They say they already have Spectrum and are happy with it. Give me the exact rebuttal." },
  { label: "Not interested",    prompt: "They said they're not interested right at the door. What do I say?" },
  { label: "Think about it",    prompt: "They want to think about it. Give me the exact close." },
  { label: "Already have fiber",prompt: "They say they already have fiber. Give me the rebuttal." },
  { label: "Opening pitch",     prompt: "Give me a strong 30-second door pitch I can say word for word." },
  { label: "Appointment close", prompt: "Give me the exact words to set an appointment when they won't commit." },
  { label: "Spouse objection",  prompt: "They say they need to talk to their spouse. What do I say right now?" },
];

export default function AiCoachChat({ leadContext, compact = false }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"coach" | "roleplay">("coach");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voice state
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [interimText, setInterimText] = useState("");
  const [hasSpeech, setHasSpeech] = useState(false);
  const [hasTts, setHasTts] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Detect browser capabilities
  useEffect(() => {
    setHasSpeech(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
    setHasTts(!!window.speechSynthesis);
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interimText]);

  // Stop TTS on unmount
  useEffect(() => {
    return () => { window.speechSynthesis?.cancel(); };
  }, []);

  // ── Text-to-speech ─────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (!hasTts || !ttsEnabled) return;
    window.speechSynthesis.cancel();
    // Strip markdown-ish formatting before speaking
    const clean = text
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/#+\s/g, "")
      .replace(/^\d+\.\s/gm, "")
      .trim();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    // Prefer a natural English voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((v) =>
      v.lang.startsWith("en") &&
      (v.name.includes("Google US English") ||
       v.name.includes("Samantha") ||
       v.name.includes("Alex") ||
       v.name.includes("Daniel"))
    ) ?? voices.find((v) => v.lang.startsWith("en"));
    if (preferred) utterance.voice = preferred;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [hasTts, ttsEnabled]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  // ── Speech-to-text ─────────────────────────────────────────────────────────
  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      setInterimText("");
      return;
    }
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;
    // Stop TTS while rep talks
    stopSpeaking();

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (interim) setInterimText(interim);
      if (final) {
        setInterimText("");
        setListening(false);
        // Auto-send the spoken message
        sendText(final.trim());
      }
    };
    recognition.onend = () => {
      setListening(false);
      setInterimText("");
    };
    recognition.onerror = () => {
      setListening(false);
      setInterimText("");
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  // ── Send message ───────────────────────────────────────────────────────────
  const sendText = useCallback(async (userText: string) => {
    if (!userText.trim() || streaming) return;
    setError(null);
    stopSpeaking();

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
        setMessages((prev) => prev.slice(0, -1));
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

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: accumulated, streaming: false };
        return updated;
      });

      // Speak the completed response
      speak(accumulated);

    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) => prev.slice(0, -1));
        setError("Network error. Try again.");
      }
    } finally {
      setStreaming(false);
    }
  }, [messages, mode, leadContext, streaming, speak, stopSpeaking]);

  const send = useCallback((text: string) => sendText(text), [sendText]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function startRoleplay() {
    setMode("roleplay");
    setMessages([]);
    sendText("Start the roleplay — you're the homeowner. I'll knock in 3 seconds.");
  }

  function reset() {
    abortRef.current?.abort();
    stopSpeaking();
    setMessages([]);
    setError(null);
    setMode("coach");
    setListening(false);
    setInterimText("");
  }

  const isEmpty = messages.length === 0;

  return (
    <div className={`flex flex-col ${compact ? "h-[500px]" : "h-full min-h-[600px]"} bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm`}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            speaking ? "bg-blue-500 animate-pulse" :
            listening ? "bg-red-500 animate-pulse" :
            mode === "roleplay" ? "bg-orange-400 animate-pulse" :
            "bg-green-400"
          }`} />
          <span className="text-sm font-semibold text-gray-900">
            {speaking ? "Rex is speaking…" :
             listening ? "Listening…" :
             mode === "roleplay" ? "Practice Mode" :
             "Rex — AI Coach"}
          </span>
          {leadContext?.address && (
            <span className="text-xs text-gray-400 truncate max-w-[120px]">{leadContext.address}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* TTS mute toggle */}
          {hasTts && (
            <button
              onClick={() => {
                if (speaking) stopSpeaking();
                setTtsEnabled((v) => !v);
              }}
              title={ttsEnabled ? "Mute coach voice" : "Unmute coach voice"}
              className={`p-1.5 rounded-lg transition-colors ${ttsEnabled ? "text-blue-600 hover:bg-blue-50" : "text-gray-300 hover:bg-gray-100"}`}
            >
              {ttsEnabled ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-3-3m3 3l3-3M9.172 16.172a4 4 0 010-5.657" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5L6 9H2v6h4l5 4V5z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              )}
            </button>
          )}

          {mode === "roleplay" ? (
            <button onClick={reset} className="text-xs text-orange-600 font-medium px-2 py-1 rounded-lg hover:bg-orange-50 transition-colors">
              End Practice
            </button>
          ) : (
            <button onClick={startRoleplay} className="text-xs text-purple-600 font-medium px-2 py-1 rounded-lg hover:bg-purple-50 transition-colors">
              Practice Mode
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
              {leadContext.att_available ? "AT&T available" : "Not yet serviceable"}
            </span>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {isEmpty && !interimText ? (
          <div className="flex flex-col gap-4 my-auto">
            <div className="text-center">
              <div className={`w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-3 transition-all ${speaking ? "ring-4 ring-blue-300 ring-offset-2 scale-105" : ""}`}>
                <span className="text-white text-xl font-bold">R</span>
              </div>
              <p className="font-semibold text-gray-800">Rex is ready</p>
              <p className="text-sm text-gray-400 mt-1">
                {hasSpeech ? "Tap the mic or type a scenario" : "Pick a scenario or type a question"}
              </p>
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
                  <div className={`w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mr-2 mt-0.5 shrink-0 transition-all ${speaking && i === messages.length - 1 ? "ring-2 ring-blue-300 scale-110" : ""}`}>
                    <span className="text-white text-xs font-bold">R</span>
                  </div>
                )}
                <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : mode === "roleplay"
                    ? "bg-orange-50 text-gray-800 border border-orange-100 rounded-bl-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}>
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                  {msg.streaming && (
                    <span className="inline-block w-1 h-3.5 bg-current ml-0.5 animate-pulse rounded-sm" />
                  )}
                </div>
                {/* Re-play button on completed assistant messages */}
                {msg.role === "assistant" && !msg.streaming && hasTts && (
                  <button
                    onClick={() => speak(msg.content)}
                    title="Play again"
                    className="self-end ml-1 mb-1 text-gray-300 hover:text-blue-400 transition-colors shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                )}
              </div>
            ))}

            {/* Interim speech text while listening */}
            {interimText && (
              <div className="flex justify-end">
                <div className="max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm bg-blue-100 text-blue-700 rounded-br-sm italic opacity-70">
                  {interimText}…
                </div>
              </div>
            )}

            {/* Follow-up chips */}
            {!streaming && !listening && messages[messages.length - 1]?.role === "assistant" && mode === "coach" && (
              <div className="flex flex-wrap gap-1.5 ml-8">
                {["Give me the exact words", "What if they push back harder?", "How do I close from here?"].map((chip) => (
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

      {/* Input row */}
      <div className="border-t border-gray-100 px-3 py-3 shrink-0">
        {/* Speaking indicator bar */}
        {speaking && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="flex gap-0.5 items-end h-4">
              {[1, 2, 3, 4, 5].map((b) => (
                <div
                  key={b}
                  className="w-1 rounded-full bg-blue-500"
                  style={{
                    height: `${Math.random() * 12 + 4}px`,
                    animation: `pulse ${0.3 + b * 0.1}s ease-in-out infinite alternate`,
                  }}
                />
              ))}
            </div>
            <span className="text-xs text-blue-500 font-medium">Rex is speaking</span>
            <button onClick={stopSpeaking} className="ml-auto text-xs text-gray-400 hover:text-gray-600">
              Stop
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Mic button */}
          {hasSpeech && (
            <button
              onClick={toggleListening}
              disabled={streaming}
              title={listening ? "Stop listening" : "Speak your message"}
              className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 ${
                listening
                  ? "bg-red-500 text-white scale-105 shadow-lg shadow-red-200"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {listening ? (
                <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10a7 7 0 0014 0M12 19v3M9 22h6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
          )}

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming || listening}
            rows={1}
            placeholder={
              listening ? "Listening…" :
              mode === "roleplay" ? "Respond to the customer…" :
              "Ask Rex anything…"
            }
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
            disabled={!input.trim() || streaming || listening}
            className="shrink-0 w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
          <p className="text-xs text-gray-400 mt-1.5 text-center">
            {hasSpeech ? "Tap mic to speak · Enter to send" : "Enter to send · Shift+Enter for new line"}
          </p>
        )}
      </div>
    </div>
  );
}
