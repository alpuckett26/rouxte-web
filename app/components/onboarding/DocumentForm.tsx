"use client";

import { FieldDef } from "@/lib/onboarding/documentForms";

interface Props {
  fields: FieldDef[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

export default function DocumentForm({ fields, values, onChange }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-1">
          {field.type === "checkbox" ? (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!values[field.key]}
                onChange={(e) => onChange(field.key, e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
              />
              <span className="text-sm text-gray-800">
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
              </span>
            </label>
          ) : (
            <>
              <label className="text-sm font-medium text-gray-700">
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>

              {field.type === "select" ? (
                <select
                  value={(values[field.key] as string) ?? ""}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                >
                  <option value="">Select…</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : field.type === "date" ? (
                <input
                  type="date"
                  value={(values[field.key] as string) ?? ""}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                />
              ) : field.type === "number" ? (
                <input
                  type="number"
                  min={0}
                  value={(values[field.key] as string) ?? ""}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                />
              ) : (
                <input
                  type="text"
                  value={(values[field.key] as string) ?? ""}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                />
              )}

              {field.hint && (
                <p className="text-xs text-gray-400">{field.hint}</p>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
