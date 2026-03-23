"use client";

import ScreenShell from "@/components/ScreenShell";

export default function OfflinePage() {
  return (
    <ScreenShell>
      <div className="flex flex-col items-center justify-center min-h-[85vh] text-center">
        <img src="/brand/rouxte-logo.png" alt="Rouxte" className="h-9 mx-auto mb-8 opacity-60" />

        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
          <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a4 4 0 000-5.656M9.172 16.172a4 4 0 010-5.656m-3.536 3.536a9 9 0 010-12.728M3 3l18 18" />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 mb-2">You&apos;re offline</h1>
        <p className="text-gray-500 max-w-xs mb-8">
          No internet connection detected. Check your signal and try again.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-blue-600 text-white px-6 py-3 text-sm font-medium shadow-sm hover:bg-blue-700 transition-colors"
        >
          Retry Connection
        </button>
      </div>
    </ScreenShell>
  );
}
