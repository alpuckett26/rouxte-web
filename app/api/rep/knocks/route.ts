import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Last 30 days, grouped by date — knocks and sales side by side
  const since = new Date();
  since.setDate(since.getDate() - 29);
  const sinceStr = since.toISOString().split("T")[0];

  const { data: knocks, error: knockErr } = await supabase
    .from("sales_activity_log")
    .select("ts")
    .eq("actor_id", user.id)
    .eq("event_type", "door_knock")
    .gte("ts", sinceStr);

  const { data: sales, error: salesErr } = await supabase
    .from("sales_activity_log")
    .select("ts")
    .eq("actor_id", user.id)
    .eq("event_type", "sale_submitted")
    .gte("ts", sinceStr);

  if (knockErr || salesErr) {
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }

  // Build a map of date → { knocks, sales }
  const byDate: Record<string, { knocks: number; sales: number }> = {};

  for (let i = 0; i < 30; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    byDate[d.toISOString().split("T")[0]] = { knocks: 0, sales: 0 };
  }

  for (const row of knocks ?? []) {
    const day = row.ts.split("T")[0];
    if (byDate[day]) byDate[day].knocks++;
  }

  for (const row of sales ?? []) {
    const day = row.ts.split("T")[0];
    if (byDate[day]) byDate[day].sales++;
  }

  const days = Object.entries(byDate).map(([date, counts]) => ({ date, ...counts }));

  return NextResponse.json({ days });
}
