"use client";

import { LeadFilters, LeadStatus } from "@/lib/types";
import { LEAD_STATUS_LABELS } from "@/lib/utils/leads";

interface Props {
  filters: LeadFilters;
  onChange: (f: LeadFilters) => void;
}

const PRESET_TAGS = ["Hot", "Follow-up", "Gate", "Dog", "Not Home", "Interested"];

export default function LeadFilterBar({ filters, onChange }: Props) {
  function set(key: keyof LeadFilters, value: unknown) {
    onChange({ ...filters, [key]: value || undefined });
  }

  function toggleTag(tag: string) {
    const current = filters.tags ?? [];
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    onChange({ ...filters, tags: next.length ? next : undefined });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      {/* Carrier filter */}
      <select
        value={filters.carrier ?? ""}
        onChange={(e) => set("carrier", e.target.value)}
        className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
      >
        <option value="">All Carriers</option>
        <option value="att">AT&T Available</option>
        <option value="other">Other Carrier</option>
      </select>

      {/* Status filter */}
      <select
        value={filters.status ?? ""}
        onChange={(e) => set("status", e.target.value as LeadStatus)}
        className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
      >
        <option value="">All Statuses</option>
        {(Object.entries(LEAD_STATUS_LABELS) as [LeadStatus, string][]).map(
          ([value, label]) => (
            <option key={value} value={value}>{label}</option>
          )
        )}
      </select>

      {/* DNK toggle */}
      <button
        onClick={() =>
          onChange({
            ...filters,
            is_do_not_knock: filters.is_do_not_knock ? undefined : false,
          })
        }
        className={`rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${
          filters.is_do_not_knock === false
            ? "border-red-300 bg-red-50 text-red-700"
            : "border-gray-200 text-gray-600 hover:bg-gray-50"
        }`}
      >
        Hide DNK
      </button>

      {/* Tag chips */}
      <div className="flex flex-wrap gap-1 ml-1">
        {PRESET_TAGS.map((tag) => {
          const active = filters.tags?.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`rounded-full border px-2 py-0.5 text-xs font-medium transition-colors ${
                active
                  ? "border-blue-400 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {/* Clear */}
      {(filters.carrier || filters.status || filters.tags?.length || filters.is_do_not_knock !== undefined) && (
        <button
          onClick={() => onChange({})}
          className="ml-auto text-xs text-gray-400 hover:text-gray-600"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
