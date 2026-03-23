"use client";

import { useEffect, useState } from "react";
import { LeadTag, Tag } from "@/lib/types";

const TAG_COLORS: Record<string, string> = {
  Hot: "bg-red-100 text-red-700 border-red-200",
  "Follow-up": "bg-yellow-100 text-yellow-700 border-yellow-200",
  Gate: "bg-orange-100 text-orange-700 border-orange-200",
  Dog: "bg-purple-100 text-purple-700 border-purple-200",
  "Not Home": "bg-gray-100 text-gray-600 border-gray-200",
  Interested: "bg-green-100 text-green-700 border-green-200",
  "Do Not Knock": "bg-red-100 text-red-700 border-red-200",
};

function tagStyle(name: string) {
  return TAG_COLORS[name] ?? "bg-blue-100 text-blue-700 border-blue-200";
}

interface Props {
  leadId: string;
  tags: LeadTag[];
  onTagsChanged: (tags: LeadTag[]) => void;
}

export default function LeadTagsTab({ leadId, tags, onTagsChanged }: Props) {
  const [orgTags, setOrgTags] = useState<Tag[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then((d) => setOrgTags(d.data ?? []));
  }, []);

  const assignedIds = new Set(tags.map((lt) => lt.tag_id));

  async function toggleTag(tag: Tag) {
    setSaving(tag.id);
    if (assignedIds.has(tag.id)) {
      // Remove
      const res = await fetch(`/api/leads/${leadId}/tags/${tag.id}`, { method: "DELETE" });
      if (res.ok) {
        onTagsChanged(tags.filter((lt) => lt.tag_id !== tag.id));
      }
    } else {
      // Add
      const res = await fetch(`/api/leads/${leadId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_id: tag.id }),
      });
      if (res.ok) {
        const d = await res.json();
        onTagsChanged([...tags, d.data]);
      }
    }
    setSaving(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Assigned tags</p>
        {tags.length === 0 ? (
          <p className="text-sm text-gray-400">No tags yet — tap one below to add it.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((lt) => {
              const name = lt.tag?.name ?? "";
              return (
                <span
                  key={lt.id}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${tagStyle(name)}`}
                >
                  {name}
                  <button
                    onClick={() => lt.tag && toggleTag(lt.tag)}
                    className="opacity-60 hover:opacity-100 transition-opacity leading-none"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Add tag</p>
        <div className="flex flex-wrap gap-2">
          {orgTags
            .filter((t) => !assignedIds.has(t.id))
            .map((t) => (
              <button
                key={t.id}
                disabled={saving === t.id}
                onClick={() => toggleTag(t)}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition-opacity ${tagStyle(t.name)} ${
                  saving === t.id ? "opacity-50" : "hover:opacity-80"
                }`}
              >
                + {t.name}
              </button>
            ))}
          {orgTags.filter((t) => !assignedIds.has(t.id)).length === 0 && (
            <p className="text-sm text-gray-400">All tags assigned.</p>
          )}
        </div>
      </div>
    </div>
  );
}
