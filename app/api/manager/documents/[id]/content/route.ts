import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import * as XLSX from "xlsx";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles").select("org_id, role").eq("user_id", user.id).maybeSingle();
  if (!profile || !["admin", "sales_manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: doc } = await admin
    .from("org_documents")
    .select("file_path, org_id, name, mime_type")
    .eq("id", id)
    .maybeSingle();

  if (!doc || doc.org_id !== profile.org_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: fileData, error: dlErr } = await admin.storage
    .from("org-documents")
    .download(doc.file_path);

  if (dlErr || !fileData) {
    return NextResponse.json({ error: "Failed to download file" }, { status: 500 });
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const mime = doc.mime_type;

  // CSV / TSV — return as-is
  if (mime.includes("csv") || mime.includes("text/plain")) {
    const text = buffer.toString("utf-8");
    return NextResponse.json({ name: doc.name, type: "csv", content: text });
  }

  // Excel
  if (mime.includes("sheet") || mime.includes("excel") || doc.file_path.match(/\.xlsx?$/i)) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheets: Record<string, unknown[][]> = {};
    for (const sheetName of workbook.SheetNames) {
      const ws = workbook.Sheets[sheetName];
      sheets[sheetName] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
    }
    return NextResponse.json({ name: doc.name, type: "excel", sheets });
  }

  return NextResponse.json({ error: "Cannot parse this file type — share it directly in chat" }, { status: 422 });
}
