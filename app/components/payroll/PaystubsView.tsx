"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Paystub {
  id: string;
  period_start: string;
  period_end: string;
  pay_type: "hourly" | "commission";
  hours_worked: number | null;
  hourly_rate: number | null;
  gross_commission: number;
  chargebacks: number;
  bonus: number;
  net_pay: number;
  sales_count: number;
  status: string;
  released_at: string | null;
}

// 1099 contractor tax set-aside guidance
const SE_TAX_RATE = 0.153;      // Self-employment tax (SS 12.4% + Medicare 2.9%)
const FED_ESTIMATE_RATE = 0.12; // Conservative federal income tax estimate
const TOTAL_RATE = SE_TAX_RATE + FED_ESTIMATE_RATE; // 27.3%

function TaxBanner({ totalNetPay }: { totalNetPay: number }) {
  const setAside = totalNetPay * TOTAL_RATE;
  const seTax = totalNetPay * SE_TAX_RATE;
  const fedTax = totalNetPay * FED_ESTIMATE_RATE;
  const fmt = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0 text-amber-500">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-amber-800 text-sm">Tax Set-Aside Reminder</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            As a 1099 independent contractor, taxes are <strong>not</strong> withheld from your pay.
            You are responsible for setting aside funds for self-employment and income taxes each period.
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-amber-100 px-3 py-2 text-center">
              <p className="text-xs text-amber-600 font-medium">SE Tax (15.3%)</p>
              <p className="text-sm font-bold text-amber-800 mt-0.5">{fmt(seTax)}</p>
            </div>
            <div className="rounded-lg bg-amber-100 px-3 py-2 text-center">
              <p className="text-xs text-amber-600 font-medium">Fed Est. (12%)</p>
              <p className="text-sm font-bold text-amber-800 mt-0.5">{fmt(fedTax)}</p>
            </div>
            <div className="rounded-lg bg-amber-200 px-3 py-2 text-center">
              <p className="text-xs text-amber-700 font-semibold">Set Aside ~27%</p>
              <p className="text-sm font-bold text-amber-900 mt-0.5">{fmt(setAside)}</p>
            </div>
          </div>

          <p className="mt-2.5 text-xs text-amber-600">
            This is an estimate only. Consult a tax professional for advice specific to your situation.
            The IRS requires quarterly estimated tax payments — due Jan, Apr, Jun, and Sep.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PaystubsView() {
  const [stubs, setStubs] = useState<Paystub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/payroll/stubs")
      .then((r) => r.json())
      .then((j) => { setStubs(j.data ?? []); setLoading(false); });
  }, []);

  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (stubs.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <svg className="mx-auto h-10 w-10 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-gray-500">No paystubs released yet.</p>
        <p className="text-sm text-gray-400 mt-1">Your manager will release stubs after each pay period.</p>
      </div>
    );
  }

  const totalNetPay = stubs.reduce((sum, s) => sum + Number(s.net_pay), 0);

  return (
    <div className="space-y-3">
      {/* Tax banner based on all released earnings */}
      <TaxBanner totalNetPay={totalNetPay} />

      {stubs.map((stub) => (
        <div key={stub.id} className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-gray-900">
                {fmtDate(stub.period_start)} – {fmtDate(stub.period_end)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 capitalize">
                {stub.pay_type} pay
                {stub.pay_type === "hourly" && stub.hours_worked != null
                  ? ` · ${stub.hours_worked}h @ ${fmt(stub.hourly_rate ?? 0)}/hr`
                  : ` · ${stub.sales_count} sale${stub.sales_count !== 1 ? "s" : ""}`
                }
              </p>
            </div>
            <Link
              href={`/payroll/stubs/${stub.id}/print`}
              target="_blank"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              View / Print
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stub.pay_type === "commission" && (
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-xs text-gray-500">Commission</p>
                <p className="font-medium">{fmt(stub.gross_commission)}</p>
              </div>
            )}
            {stub.pay_type === "hourly" && (
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-xs text-gray-500">Hours Pay</p>
                <p className="font-medium">{fmt((stub.hours_worked ?? 0) * (stub.hourly_rate ?? 0))}</p>
              </div>
            )}
            {stub.chargebacks > 0 && (
              <div className="rounded-lg bg-red-50 p-2">
                <p className="text-xs text-red-500">Chargebacks</p>
                <p className="font-medium text-red-600">-{fmt(stub.chargebacks)}</p>
              </div>
            )}
            {stub.bonus > 0 && (
              <div className="rounded-lg bg-green-50 p-2">
                <p className="text-xs text-green-600">Bonus</p>
                <p className="font-medium text-green-700">+{fmt(stub.bonus)}</p>
              </div>
            )}
            <div className="rounded-lg bg-blue-50 p-2">
              <p className="text-xs text-blue-600">Net Pay</p>
              <p className="font-semibold text-lg text-blue-700">{fmt(stub.net_pay)}</p>
            </div>
          </div>

          {/* Per-stub tax suggestion */}
          <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
            <p className="text-xs text-amber-700">Suggested tax set-aside (~27%)</p>
            <p className="text-sm font-semibold text-amber-800">{fmt(Number(stub.net_pay) * TOTAL_RATE)}</p>
          </div>

          {stub.released_at && (
            <p className="mt-2 text-xs text-gray-400">
              Released {new Date(stub.released_at).toLocaleDateString()}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
