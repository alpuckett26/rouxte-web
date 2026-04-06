"use client";

import { useEffect, useState } from "react";

interface TrainingFile {
  name: string;
  path: string;
  url: string;
}

interface Section {
  folder: string;
  label: string;
  files: TrainingFile[];
}

function cleanName(fileName: string): string {
  return fileName
    .replace(/\.docx$/i, "")
    .replace(/^Training Doc\s*/i, "")
    .replace(/^\d+\s*[-.]?\s*/, "")
    .trim();
}

function DocIcon() {
  return (
    <svg className="h-5 w-5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

export default function TrainingLibrary() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/training")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setSections(d.data ?? []);
      })
      .catch(() => setError("Failed to load training documents"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
    );
  }

  const trainingSection = sections.find((s) => s.folder === "training");
  const contractsSection = sections.find((s) => s.folder === "contracts");

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Training Library</h1>
        <p className="text-sm text-gray-500 mt-0.5">Click any document to download and read</p>
      </div>

      {trainingSection && trainingSection.files.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Training Modules
          </h2>
          <div className="flex flex-col gap-2">
            {trainingSection.files.map((file) => (
              <a
                key={file.path}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 hover:bg-blue-50 hover:border-blue-200 transition-colors shadow-sm group"
              >
                <DocIcon />
                <span className="flex-1 text-sm font-medium text-gray-800 group-hover:text-blue-700">
                  {cleanName(file.name)}
                </span>
                <svg className="h-4 w-4 text-gray-300 group-hover:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
            ))}
          </div>
        </section>
      )}

      {contractsSection && contractsSection.files.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Contracts & Expectations
          </h2>
          <div className="flex flex-col gap-2">
            {contractsSection.files.map((file) => (
              <a
                key={file.path}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 hover:bg-blue-50 hover:border-blue-200 transition-colors shadow-sm group"
              >
                <DocIcon />
                <span className="flex-1 text-sm font-medium text-gray-800 group-hover:text-blue-700">
                  {file.name.replace(/\.docx$/i, "")}
                </span>
                <svg className="h-4 w-4 text-gray-300 group-hover:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
