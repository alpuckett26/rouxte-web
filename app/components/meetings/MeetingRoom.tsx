"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  meetingId: string;
  onLeave: () => void;
}

type CallState = "loading" | "joining" | "joined" | "error";

export default function MeetingRoom({ meetingId, onLeave }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callFrameRef  = useRef<any>(null);
  const [callState, setCallState] = useState<CallState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(1);

  const endMeeting = useCallback(async () => {
    await fetch(`/api/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ended" }),
    });
    onLeave();
  }, [meetingId, onLeave]);

  useEffect(() => {
    if (!containerRef.current) return;
    let mounted = true;

    async function startCall() {
      try {
        // Lazy-load daily-js (client-only, large bundle)
        const DailyIframe = (await import("@daily-co/daily-js")).default;

        if (!mounted || !containerRef.current) return;

        // Get token from our API
        const tokenRes = await fetch(`/api/meetings/${meetingId}/token`, { method: "POST" });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(tokenData.error ?? "Failed to get meeting token");

        if (!mounted || !containerRef.current) return;

        setCallState("joining");

        const frame = DailyIframe.createFrame(containerRef.current, {
          showLeaveButton: true,
          showFullscreenButton: true,
          iframeStyle: {
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            border: "none",
            borderRadius: "0",
          },
        });
        callFrameRef.current = frame;

        frame.on("joined-meeting", () => {
          if (mounted) setCallState("joined");
        });

        frame.on("participant-joined", () => {
          if (mounted) setParticipantCount((c) => c + 1);
        });

        frame.on("participant-left", () => {
          if (mounted) setParticipantCount((c) => Math.max(1, c - 1));
        });

        frame.on("left-meeting", () => {
          if (mounted) onLeave();
        });

        frame.on("error", (e: { errorMsg?: string }) => {
          if (mounted) {
            setErrorMsg(e?.errorMsg ?? "Call error");
            setCallState("error");
          }
        });

        await frame.join({ url: tokenData.room_url, token: tokenData.token });
      } catch (err: unknown) {
        if (mounted) {
          setErrorMsg(err instanceof Error ? err.message : "Failed to start call");
          setCallState("error");
        }
      }
    }

    startCall();

    return () => {
      mounted = false;
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
        callFrameRef.current = null;
      }
    };
  }, [meetingId, onLeave]);

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
      {/* Minimal top bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${callState === "joined" ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`} />
          <span className="text-sm font-medium text-white">
            {callState === "loading"  ? "Connecting…" :
             callState === "joining"  ? "Joining call…" :
             callState === "joined"   ? `In call · ${participantCount} participant${participantCount !== 1 ? "s" : ""}` :
             "Call error"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onLeave}
            className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Leave quietly
          </button>
          <button
            onClick={endMeeting}
            className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            End for all
          </button>
        </div>
      </div>

      {/* Call container — Daily renders its iframe here */}
      <div className="flex-1 relative">
        <div ref={containerRef} className="absolute inset-0" />

        {/* Loading overlay */}
        {(callState === "loading" || callState === "joining") && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-400">
                {callState === "loading" ? "Preparing your call…" : "Joining room…"}
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {callState === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
            <div className="text-center max-w-sm px-6">
              <p className="text-lg font-semibold text-white mb-2">Couldn't join the call</p>
              <p className="text-sm text-gray-400 mb-6">{errorMsg}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => { setCallState("loading"); setErrorMsg(null); }}
                  className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl"
                >
                  Try again
                </button>
                <button
                  onClick={onLeave}
                  className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-xl hover:bg-gray-800"
                >
                  Leave
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
