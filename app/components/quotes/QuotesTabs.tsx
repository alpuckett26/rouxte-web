"use client";

import { useState } from "react";
import QuoteBuilder from "./QuoteBuilder";
import FiberQuoteBuilder from "./FiberQuoteBuilder";

type Tab = "wireless" | "fiber";

export default function QuotesTabs() {
  const [tab, setTab] = useState<Tab>("wireless");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2">
        <button
          onClick={() => setTab("wireless")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            tab === "wireless"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}>
          Wireless
        </button>
        <button
          onClick={() => setTab("fiber")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            tab === "fiber"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}>
          Fiber / Internet
        </button>
      </div>

      {tab === "wireless" ? <QuoteBuilder /> : <FiberQuoteBuilder />}
    </div>
  );
}
