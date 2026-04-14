"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import MeetingRoom from "./MeetingRoom";

interface Meeting {
  id: string;
  title: string;
  meeting_type: "instant" | "scheduled";
  status: "waiting" | "live" | "ended";
  scheduled_at: string | null;
  created_at: string;
  ended_at: string | null;
  room_url: string;
  created_by: string;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getDate()    === today.getDate()    &&
    d.getMonth()   === today.getMonth()   &&
    d.getFullYear() === today.getFullYear();
  const isTomorrow =
    d.getDate()    === today.getDate() + 1 &&
    d.getMonth()   === today.getMonth()    &&
    d.getFullYear() === today.getFullYear();

  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isToday)    return `Today ${time}`;
  if (isTomorrow) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

export default function MeetingHub() {
  const router = useRouter();
  const [active,  setActive]  = useState<Meeting[]>([]);
  const [recent,  setRecent]  = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [schedTitle,   setSchedTitle]   = useState("");
  const [schedAt,      setSchedAt]      = useState("");
  const [inCallId, setInCallId] = useState<string | null>(null);
  const [dailyAvailable, setDailyAvailable] = useState<boolean | null>(null);

  // Check if Daily is configured
  useEffect(() => {
    fetch("/api/meetings").then((r) => {
      if (r.status === 503) setDailyAvailable(false);
      else setDailyAvailable(true);
    }).catch(() => setDailyAvailable(false));
  }, []);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    const res  = await fetch("/api/meetings");
    const json = await res.json();
    setActive(json.data?.active  ?? []);
    setRecent(json.data?.recent  ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  async function startInstant() {
    setCreating(true);
    const res  = await fetch("/api/meetings", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ title: "Instant Meeting", meeting_type: "instant" }),
    });
    const json = await res.json();
    setCreating(false);
    if (res.ok && json.data?.id) {
      setInCallId(json.data.id);
      fetchMeetings();
    }
  }

  async function scheduleNew() {
    if (!schedTitle.trim() || !schedAt) return;
    setCreating(true);
    const res = await fetch("/api/meetings", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        title:        schedTitle.trim(),
        meeting_type: "scheduled",
        scheduled_at: new Date(schedAt).toISOString(),
      }),
    });
    setCreating(false);
    if (res.ok) {
      setShowSchedule(false);
      setSchedTitle("");
      setSchedAt("");
      fetchMeetings();
    }
  }

  async function endMeeting(id: string) {
    await fetch(`/api/meetings/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status: "ended" }),
    });
    fetchMeetings();
  }

  // If user is in a call, render the full-screen call view
  if (inCallId) {
    return (
      <MeetingRoom
        meetingId={inCallId}
        onLeave={() => { setInCallId(null); fetchMeetings(); }}
      />
    );
  }

  const liveNow = active.filter((m) => m.status === "live");
  const scheduled = active.filter((m) => m.status === "waiting" && m.scheduled_at);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Meetings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Video meetings for your team — no Zoom required.</p>
      </div>

      {/* Not configured */}
      {dailyAvailable === false && (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          <strong>Setup needed:</strong> Add <code className="font-mono text-xs bg-yellow-100 px-1 rounded">DAILY_API_KEY</code> to your Vercel environment variables. Get a free API key at <strong>daily.co</strong>.
        </div>
      )}

      {/* Primary action row */}
      <div className="flex gap-3">
        <button
          onClick={startInstant}
          disabled={creating || dailyAvailable === false}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-2xl py-4 text-sm transition-colors"
        >
          {creating ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
          {creating ? "Starting…" : "Start Instant Meeting"}
        </button>
        <button
          onClick={() => setShowSchedule((v) => !v)}
          className="px-5 py-4 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-colors"
        >
          Schedule
        </button>
      </div>

      {/* Schedule form */}
      {showSchedule && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-900">Schedule a meeting</p>
          <input
            type="text"
            value={schedTitle}
            onChange={(e) => setSchedTitle(e.target.value)}
            placeholder="Meeting title (e.g. Weekly Pow-Wow)"
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <input
            type="datetime-local"
            value={schedAt}
            onChange={(e) => setSchedAt(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowSchedule(false); setSchedTitle(""); setSchedAt(""); }}
              className="text-sm text-gray-500 px-4 py-2 rounded-xl hover:bg-gray-100"
            >Cancel</button>
            <button
              onClick={scheduleNew}
              disabled={!schedTitle.trim() || !schedAt || creating}
              className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-xl"
            >
              {creating ? "Scheduling…" : "Schedule"}
            </button>
          </div>
        </div>
      )}

      {/* Live now */}
      {liveNow.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Live Now</p>
          <div className="space-y-2">
            {liveNow.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-green-50 border border-green-200"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{m.title}</p>
                  <p className="text-xs text-gray-500">Started {fmtTime(m.created_at)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setInCallId(m.id)}
                    className="text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    Join
                  </button>
                  <button
                    onClick={() => endMeeting(m.id)}
                    className="text-xs text-red-600 hover:text-red-800 px-2 py-1.5 rounded-xl hover:bg-red-50 transition-colors"
                  >
                    End
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled */}
      {scheduled.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Upcoming</p>
          <div className="space-y-2">
            {scheduled.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-gray-200"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{m.title}</p>
                  <p className="text-xs text-gray-500">{fmtTime(m.scheduled_at)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setInCallId(m.id)}
                    className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    Start Early
                  </button>
                  <button
                    onClick={() => endMeeting(m.id)}
                    className="text-xs text-gray-400 hover:text-red-600 px-2 py-1.5 rounded-xl hover:bg-red-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No active */}
      {!loading && liveNow.length === 0 && scheduled.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 py-12 text-center">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-gray-500">No meetings yet — start one above.</p>
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {[1,2].map((i) => <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      )}

      {/* Recent */}
      {recent.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Recent</p>
          <div className="space-y-1">
            {recent.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{m.title}</p>
                </div>
                <p className="text-xs text-gray-400 shrink-0">{fmtTime(m.ended_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
