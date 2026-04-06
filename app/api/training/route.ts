import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "training-docs";

const FOLDER_LABELS: Record<string, string> = {
  training: "Training",
  contracts: "Contracts & Expectations",
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const folders = ["training", "contracts"];
  const sections: { folder: string; label: string; files: { name: string; path: string; url: string }[] }[] = [];

  for (const folder of folders) {
    const { data: files, error } = await admin.storage.from(BUCKET).list(folder, { sortBy: { column: "name", order: "asc" } });
    if (error || !files) continue;

    const withUrls = await Promise.all(
      files
        .filter((f) => f.name !== ".emptyFolderPlaceholder")
        .map(async (f) => {
          const storagePath = `${folder}/${f.name}`;
          const { data } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
          return { name: f.name, path: storagePath, url: data?.signedUrl ?? "" };
        })
    );

    sections.push({ folder, label: FOLDER_LABELS[folder] ?? folder, files: withUrls });
  }

  return NextResponse.json({ data: sections });
}
