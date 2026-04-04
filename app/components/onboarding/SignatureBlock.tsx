"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
  docTitle: string;
}

export default function SignatureBlock({ value, onChange, docTitle }: Props) {
  return (
    <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
      <div className="flex items-start gap-3 mb-4">
        <svg className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-blue-900">Electronic Signature</p>
          <p className="text-xs text-blue-700 mt-0.5">
            By typing your full legal name below, you are signing this document — <strong>{docTitle}</strong> — electronically.
            This signature has the same legal effect as a handwritten signature.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-blue-900">
          Type your full legal name to sign <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Jane Smith"
          className="rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          style={{ fontFamily: "cursive", fontSize: "1.1rem" }}
        />
      </div>

      {value.trim() && (
        <p className="text-xs text-blue-600 mt-2">
          Signed as: <span className="font-medium italic">{value}</span> · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      )}
    </div>
  );
}
