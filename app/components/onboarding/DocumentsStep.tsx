"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DOCUMENT_FORM_DEFS } from "@/lib/onboarding/documentForms";
import DocumentForm from "@/components/onboarding/DocumentForm";
import SignatureBlock from "@/components/onboarding/SignatureBlock";
import Button from "@/components/ui/Button";

interface DocTemplate {
  id: string;
  doc_type: string;
  title: string;
  display_order: number;
  submitted: boolean;
}

export default function DocumentsStep() {
  const router = useRouter();
  const [docs, setDocs] = useState<DocTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [signedName, setSignedName] = useState("");
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");

  const fetchDocs = useCallback(async () => {
    const res = await fetch("/api/onboarding/documents");
    const d = await res.json();
    const fetched: DocTemplate[] = d.data ?? [];
    setDocs(fetched);
    // Jump to first un-submitted doc
    const firstPending = fetched.findIndex((doc) => !doc.submitted);
    setCurrentIdx(firstPending >= 0 ? firstPending : 0);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const allDone = docs.length > 0 && docs.every((d) => d.submitted);
  const current = docs[currentIdx];
  const def = current ? DOCUMENT_FORM_DEFS[current.doc_type as keyof typeof DOCUMENT_FORM_DEFS] : null;

  function updateField(key: string, value: unknown) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }

  function validateForm(): string | null {
    if (!def) return null;
    for (const field of def.fields) {
      if (!field.required) continue;
      const val = formValues[field.key];
      if (field.type === "checkbox" && !val) return `Please check: "${field.label}"`;
      if (field.type !== "checkbox" && (!val || String(val).trim() === "")) {
        return `"${field.label}" is required`;
      }
    }
    if (!signedName.trim()) return "Please type your full name to sign";
    return null;
  }

  async function submitDoc() {
    if (!current) return;
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }
    setError("");
    setSaving(true);

    try {
      const res = await fetch(`/api/onboarding/documents/${current.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_data: formValues, signed_name: signedName }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to submit");
      }

      // Mark submitted locally
      setDocs((prev) => prev.map((d) => d.id === current.id ? { ...d, submitted: true } : d));

      // Advance to next pending
      const nextIdx = docs.findIndex((d, i) => i > currentIdx && !d.submitted);
      if (nextIdx >= 0) {
        setCurrentIdx(nextIdx);
        setFormValues({});
        setSignedName("");
      }
      // else all done — will re-render with allDone=true
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function completeOnboarding() {
    setCompleting(true);
    const res = await fetch("/api/onboarding/documents/complete", { method: "POST" });
    if (res.ok) {
      router.push("/dashboard");
    } else {
      const d = await res.json();
      setError(d.error ?? "Failed to complete onboarding");
      setCompleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse max-w-lg mx-auto mt-12">
        <div className="h-4 bg-gray-100 rounded w-2/3" />
        <div className="h-64 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">Document completion</p>
          <p className="text-sm text-gray-500">
            {docs.filter((d) => d.submitted).length} / {docs.length} signed
          </p>
        </div>
        <div className="flex gap-1.5">
          {docs.map((doc, i) => (
            <button
              key={doc.id}
              onClick={() => { setCurrentIdx(i); setFormValues({}); setSignedName(""); setError(""); }}
              className={`flex-1 h-2 rounded-full transition-colors ${
                doc.submitted
                  ? "bg-green-500"
                  : i === currentIdx
                  ? "bg-blue-500"
                  : "bg-gray-200"
              }`}
              title={doc.title}
            />
          ))}
        </div>
        <div className="flex mt-1.5">
          {docs.map((doc, i) => (
            <div key={doc.id} className="flex-1 px-0.5">
              <p className={`text-[10px] truncate ${i === currentIdx ? "text-blue-600 font-medium" : "text-gray-400"}`}>
                {doc.title.split(" ").slice(0, 2).join(" ")}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* All done state */}
      {allDone ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">All documents signed!</h2>
          <p className="text-sm text-gray-500 mb-6">
            Your onboarding documents are complete. You&apos;re ready to get started.
          </p>
          {error && (
            <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600 mb-4">
              {error}
            </p>
          )}
          <Button size="lg" loading={completing} onClick={completeOnboarding} className="w-full">
            Finish & Go to Dashboard
          </Button>
        </div>
      ) : current && def ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          {/* Doc header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              {current.submitted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Signed
                </span>
              )}
              <span className="text-xs text-gray-400">{def.subtitle}</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{def.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{def.description}</p>
          </div>

          {current.submitted ? (
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              This document has been signed. Click a different document above to review or re-sign it.
            </div>
          ) : (
            <>
              <DocumentForm
                fields={def.fields}
                values={formValues}
                onChange={updateField}
              />

              <SignatureBlock
                value={signedName}
                onChange={setSignedName}
                docTitle={def.title}
              />

              {error && (
                <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600 mt-4">
                  {error}
                </p>
              )}

              <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Submitted securely · {new Date().toLocaleDateString()}
                </p>
                <Button loading={saving} onClick={submitDoc}>
                  Sign & Continue →
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
