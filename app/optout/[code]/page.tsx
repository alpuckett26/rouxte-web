"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type State = "idle" | "loading" | "success" | "error";

export default function OptOutPage() {
  const { code } = useParams<{ code: string }>();
  const [address, setAddress] = useState("");
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;

    setState("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/optout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim(), qr_code: code }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Something went wrong.");
      }

      setState("success");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setState("error");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo mark */}
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center">
            <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
              <path
                d="M8 8 L24 24 M24 8 L8 24"
                stroke="url(#optout-grad)"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="optout-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          {state === "success" ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">You&apos;re on the list</h1>
              <p className="text-gray-500 text-sm">
                Your address has been recorded. Our representatives will not visit your home.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900 mb-1">Do Not Solicit Request</h1>
                <p className="text-sm text-gray-500">
                  Enter your address below and we will add it to our do-not-solicit list. Our
                  representatives will be notified not to visit your home.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  label="Street address"
                  value={address}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
                  placeholder="123 Main St, Austin, TX 78701"
                  required
                />

                {state === "error" && (
                  <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                    {errorMsg}
                  </p>
                )}

                <Button
                  type="submit"
                  loading={state === "loading"}
                  className="w-full"
                >
                  Submit Request
                </Button>
              </form>

              <p className="text-xs text-gray-400 mt-4 text-center">
                This request is processed immediately. No account required.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
