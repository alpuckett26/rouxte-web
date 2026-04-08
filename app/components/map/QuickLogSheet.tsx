"use client";

import { useEffect, useRef, useState } from "react";
import { Lead } from "@/lib/types";

interface Props {
  lead: Lead;
  onClose: () => void;
  onStatusLogged: (newStatus: string) => void;
  onOpenFull: () => void;
}

const DISPOSITIONS = [
  { status: "attempted",       label: "No Answer",        color: "bg-orange-100 text-orange-700 border-orange-200",  dot: "bg-orange-400" },
  { status: "contacted",       label: "Contacted",         color: "bg-blue-100 text-blue-700 border-blue-200",        dot: "bg-blue-500" },
  { status: "qualified",       label: "Interested",        color: "bg-purple-100 text-purple-700 border-purple-200",  dot: "bg-purple-500" },
  { status: "appointment_set", label: "Appt Set",          color: "bg-yellow-100 text-yellow-700 border-yellow-200",  dot: "bg-yellow-400" },
  { status: "closed_lost",     label: "Not Interested",    color: "bg-red-100 text-red-700 border-red-200",           dot: "bg-red-400" },
  { status: "sold",            label: "SOLD",              color: "bg-green-100 text-green-700 border-green-200",     dot: "bg-green-500" },
];

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: { [key: number]: { [key: number]: { transcript: string } } };
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export default function QuickLogSheet({ lead, onClose, onStatusLogged, onOpenFull }: Props) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState<string | null>(null); // status being saved
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const hasSpeech = typeof window !== "undefined" &&
    (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);

  // Tap outside to close
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onClose]);

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setNote((prev) => (prev ? prev + " " + transcript : transcript));
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  async function logStatus(status: string) {
    setSaving(status);
    try {
      await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      // Log a door_knock event for every disposition tap
      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "door_knock",
          lead_id: lead.id,
          summary: `Knocked — ${lead.address}`,
          metadata: { disposition: status },
        }),
      });

      // Save note if any
      if (note.trim()) {
        await fetch(`/api/leads/${lead.id}/note`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: note.trim() }),
        });
      }

      onStatusLogged(status);
    } finally {
      setSaving(null);
    }
  }

  const currentDisp = DISPOSITIONS.find((d) => d.status === lead.status);

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 flex justify-center pointer-events-none">
      <div
        ref={sheetRef}
        className="pointer-events-auto w-full max-w-lg bg-white rounded-t-3xl shadow-2xl border-t border-gray-100 animate-slide-up"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-5 pb-6 pt-2 flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{lead.address}</p>
              {lead.customer_name && (
                <p className="text-sm text-gray-500 mt-0.5">{lead.customer_name}</p>
              )}
              {currentDisp && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`w-2 h-2 rounded-full ${currentDisp.dot}`} />
                  <span className="text-xs text-gray-400">{currentDisp.label}</span>
                </div>
              )}
            </div>
            <button
              onClick={onOpenFull}
              className="shrink-0 text-xs text-blue-600 font-medium px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              Full Details
            </button>
          </div>

          {/* Disposition buttons — Spotio-style big colored grid */}
          <div className="grid grid-cols-3 gap-2">
            {DISPOSITIONS.map((d) => (
              <button
                key={d.status}
                disabled={!!saving}
                onClick={() => logStatus(d.status)}
                className={`relative rounded-2xl border py-3.5 text-sm font-semibold transition-all active:scale-95 ${d.color} ${
                  saving === d.status ? "opacity-70" : ""
                } ${lead.status === d.status ? "ring-2 ring-offset-1 ring-gray-400" : ""}`}
              >
                {saving === d.status ? (
                  <svg className="w-4 h-4 animate-spin mx-auto" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  d.label
                )}
              </button>
            ))}
          </div>

          {/* Note field + voice */}
          <div className="flex items-end gap-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note... (optional)"
              rows={2}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            {hasSpeech && (
              <button
                onClick={toggleVoice}
                className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  listening
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
                title="Voice note"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            )}
          </div>

          {note.trim() && (
            <button
              disabled={!!saving}
              onClick={() => logStatus(lead.status)}
              className="w-full rounded-xl bg-gray-900 text-white text-sm font-medium py-3 hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Save Note Only
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
