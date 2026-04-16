"use client";

import { useState } from "react";

interface Props {
  token: string;
  email: string;
  onDismiss: () => void;
}

export default function InviteLinkCard({ token, email, onDismiss }: Props) {
  const [copied, setCopied] = useState(false);
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${token}`;

  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="rounded-2xl bg-green-50 border border-green-200 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-green-800">Invite created for {email}</p>
          <p className="text-xs text-green-600 mt-0.5">Share this link — expires in 7 days</p>
        </div>
        <button onClick={onDismiss} className="text-green-400 hover:text-green-600 text-lg leading-none">
          ×
        </button>
      </div>
      <div className="flex gap-2 items-center">
        <code className="flex-1 rounded-xl bg-white border border-green-200 px-3 py-2 text-xs text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap">
          {url}
        </code>
        <button
          onClick={copy}
          className="shrink-0 rounded-xl bg-green-600 hover:bg-green-700 text-white px-3 py-2 text-xs font-medium transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
