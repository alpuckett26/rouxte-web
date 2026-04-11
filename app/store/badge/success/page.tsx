"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function BadgeSuccessPage() {
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOrderId(params.get("order_id"));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Success ring animation */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
          <div className="relative w-24 h-24 rounded-full bg-green-500/10 border-2 border-green-500 flex items-center justify-center">
            <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Order Confirmed!</h1>
          <p className="text-slate-400 text-sm">
            Your payment was processed successfully.
          </p>
          {orderId && (
            <p className="text-slate-600 text-xs mt-1 font-mono">Order #{orderId.slice(0, 8).toUpperCase()}</p>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left space-y-3">
          <div className="flex gap-3 text-sm">
            <span className="text-2xl">⬇️</span>
            <div>
              <div className="font-medium text-white">Digital download</div>
              <div className="text-slate-400 text-xs">Your print-ready badge PDF has been sent to your email.</div>
            </div>
          </div>
          <div className="flex gap-3 text-sm">
            <span className="text-2xl">🖨️</span>
            <div>
              <div className="font-medium text-white">Physical badge</div>
              <div className="text-slate-400 text-xs">Sent to print. You&apos;ll receive a tracking email in 1-2 business days.</div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href="/store"
            className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 hover:border-slate-500 text-sm text-center transition-colors"
          >
            Back to Store
          </Link>
          <Link
            href="/dashboard"
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm text-center font-medium transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
