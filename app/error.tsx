"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-red-500 mb-4">!</p>
        <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-gray-400 mb-8">
          An unexpected error occurred. Try refreshing or return to the dashboard.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-3 rounded-xl transition-colors"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="bg-white/10 hover:bg-white/20 text-white font-medium px-6 py-3 rounded-xl transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
