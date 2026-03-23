import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_TAGS = [
  { name: "Hot", color: "red" },
  { name: "Follow-up", color: "yellow" },
  { name: "Interested", color: "green" },
  { name: "Gate", color: "orange" },
  { name: "Dog", color: "purple" },
  { name: "Not Home", color: "gray" },
  { name: "Do Not Knock", color: "red" },
];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  // Seed default tags if none exist for this org
  const { data: existing } = await admin
    .from("tags")
    .select("id")
    .eq("org_id", profile.org_id)
    .limit(1);

  if (!existing?.length) {
    await admin.from("tags").insert(
      DEFAULT_TAGS.map((t) => ({ ...t, org_id: profile.org_id }))
    );
  }

  const { data, error } = await admin
    .from("tags")
    .select("*")
    .eq("org_id", profile.org_id)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
