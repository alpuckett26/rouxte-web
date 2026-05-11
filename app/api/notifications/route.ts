import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, data, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const unread = (data ?? []).filter((n) => !n.read_at).length;
  return NextResponse.json({ notifications: data ?? [], unread });
}
