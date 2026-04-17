"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useProfile } from "@/lib/hooks/useProfile";

const CATEGORIES = [
  { value: "promos",      label: "Promos",       color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "calculation", label: "Calculations",  color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "training",    label: "Training",      color: "bg-green-100 text-green-700 border-green-200" },
  { value: "forms",       label: "Forms",         color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "other",       label: "Other",         color: "bg-gray-100 text-gray-600 border-gray-200" },
];

function catStyle(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.color ?? "bg-gray-100 text-gray-600 border-gray-200";
}
function catLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fileIcon(mime: string) {
  if (mime.includes("pdf")) return "📄";
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) return "📊";
  if (mime.includes("word")) return "📝";
  if (mime.includes("image")) return "🖼️";
  return "📁";
}

interface Doc {
  id: string;
  name: string;
  description: string | null;
  category: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  url: string | null;
}

export default function ResourceLibrary() {
  const { profile } = useProfile();
  const isManager = profile?.role === "admin" || profile?.role === "sales_manager";

  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [showUpload, setShowUpload] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Upload form state
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadCat, setUploadCat] = useState("promos");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/manager/documents");
    if (res.ok) {
      const json = await res.json();
      setDocs(json.documents ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  function onFileChange(f: File) {
    setUploadFile(f);
    if (!uploadName) setUploadName(f.name.replace(/\.[^.]+$/, ""));
    setUploadError(null);
  }

  async function submitUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile || !uploadName.trim()) return;
    setUploading(true);
    setUploadError(null);

    const fd = new FormData();
    fd.append("file", uploadFile);
    fd.append("name", uploadName.trim());
    fd.append("description", uploadDesc.trim());
    fd.append("category", uploadCat);

    const res = await fetch("/api/manager/documents", { method: "POST", body: fd });
    const json = await res.json();
    setUploading(false);

    if (!res.ok) { setUploadError(json.error ?? "Upload failed"); return; }

    setShowUpload(false);
    setUploadFile(null); setUploadName(""); setUploadDesc(""); setUploadCat("promos");
    if (fileRef.current) fileRef.current.value = "";
    fetchDocs();
  }

  async function deleteDoc(id: string) {
    setDeleting(id);
    await fetch(`/api/manager/documents/${id}`, { method: "DELETE" });
    setDocs((prev) => prev.filter((d) => d.id !== id));
    setDeleting(null);
    setConfirmDelete(null);
  }

  const visible = filterCat === "all" ? docs : docs.filter((d) => d.category === filterCat);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Resource Library</h1>
          <p className="text-sm text-gray-500 mt-1">Promo sheets, calculation guides, and team documents.</p>
        </div>
        {isManager && (
          <button
            onClick={() => setShowUpload((v) => !v)}
            className="shrink-0 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Upload
          </button>
        )}
      </div>

      {/* Upload form */}
      {showUpload && isManager && (
        <form onSubmit={submitUpload} className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-5 space-y-4">
          <p className="text-sm font-semibold text-blue-900">Upload document</p>

          {/* Drop zone */}
          <div
            className={`rounded-xl border-2 border-dashed px-5 py-6 text-center cursor-pointer transition-colors ${
              uploadFile ? "border-blue-400 bg-blue-100" : "border-blue-200 bg-white hover:border-blue-400"
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) onFileChange(f);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.xlsx,.xls,.csv,.txt,.doc,.docx,.png,.jpg,.jpeg"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileChange(f); }}
            />
            {uploadFile ? (
              <div>
                <p className="text-sm font-semibold text-blue-800">{uploadFile.name}</p>
                <p className="text-xs text-blue-600">{fmtSize(uploadFile.size)}</p>
                <button type="button" onClick={(e) => { e.stopPropagation(); setUploadFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                  className="mt-2 text-xs text-blue-500 underline">Remove</button>
              </div>
            ) : (
              <div>
                <svg className="mx-auto h-8 w-8 text-blue-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm text-blue-700 font-medium">Tap to select or drag & drop</p>
                <p className="text-xs text-blue-400 mt-1">PDF, Excel, CSV, Word, Image — up to 50 MB</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-600 mb-1 block font-medium">Document name *</label>
              <input
                required value={uploadName} onChange={(e) => setUploadName(e.target.value)}
                placeholder="e.g. NDSc Wireless Promos — April 2025"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Category</label>
              <select value={uploadCat} onChange={(e) => setUploadCat(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100">
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)}
                placeholder="Brief note about this file"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"
              />
            </div>
          </div>

          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

          <div className="flex gap-3">
            <button type="button" onClick={() => { setShowUpload(false); setUploadFile(null); setUploadError(null); }}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={uploading || !uploadFile}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {uploading ? "Uploading…" : "Upload"}
            </button>
          </div>
        </form>
      )}

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterCat("all")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
            filterCat === "all" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
          }`}
        >
          All ({docs.length})
        </button>
        {CATEGORIES.map((c) => {
          const count = docs.filter((d) => d.category === c.value).length;
          if (count === 0) return null;
          return (
            <button key={c.value} onClick={() => setFilterCat(c.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                filterCat === c.value ? "bg-gray-900 text-white border-gray-900" : `${c.color} hover:opacity-80`
              }`}>
              {c.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Document list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-white px-5 py-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
          <p className="text-sm text-gray-500">
            {docs.length === 0 ? "No documents yet." : "No documents in this category."}
          </p>
          {isManager && docs.length === 0 && (
            <button onClick={() => setShowUpload(true)}
              className="mt-3 text-sm text-blue-600 font-medium hover:underline">
              Upload your first document →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((doc) => (
            <div key={doc.id} className="rounded-2xl border border-gray-100 bg-white px-5 py-4 flex items-start gap-4 hover:border-gray-200 transition-colors">
              <div className="text-2xl shrink-0 mt-0.5">{fileIcon(doc.mime_type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 truncate">{doc.name}</p>
                  <span className={`text-[11px] font-semibold border rounded-full px-2 py-0.5 shrink-0 ${catStyle(doc.category)}`}>
                    {catLabel(doc.category)}
                  </span>
                </div>
                {doc.description && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{doc.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {fmtSize(doc.file_size)} · {fmtDate(doc.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" download
                    className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Open
                  </a>
                )}
                {isManager && (
                  confirmDelete === doc.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => deleteDoc(doc.id)} disabled={deleting === doc.id}
                        className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">
                        {deleting === doc.id ? "…" : "Delete"}
                      </button>
                      <span className="text-gray-300">/</span>
                      <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(doc.id)}
                      className="p-1.5 text-gray-300 hover:text-red-400 transition-colors">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
