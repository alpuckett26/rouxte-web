"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const json = await res.json();
      setNotifications(json.notifications ?? []);
      setUnread(json.unread ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription for live delivery
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function setup() {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return;

      channel = supabase
        .channel("notifications-bell")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => {
            const n = payload.new as Notification;
            setNotifications((prev) => [n, ...prev].slice(0, 30));
            setUnread((c) => c + 1);
          }
        )
        .subscribe();
    }

    setup();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnread(0);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-xl z-50">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {loading && notifications.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-400">Loading…</p>
            )}
            {!loading && notifications.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-400">No notifications yet</p>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`px-4 py-3 ${!n.read_at ? "bg-blue-50/60" : ""}`}
              >
                <p className={`text-sm font-medium ${!n.read_at ? "text-blue-900" : "text-gray-900"}`}>
                  {n.title}
                </p>
                <p className="mt-0.5 text-xs text-gray-500 leading-snug">{n.body}</p>
                <p className="mt-1 text-[11px] text-gray-400">{timeAgo(n.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
