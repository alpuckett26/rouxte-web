import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";

const DEMO_ADMIN_EMAIL = "demo-admin@rouxte-pro.test";
const DEMO_PASSWORD = "rouxte-demo";

function demoEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEMO === "true";
}

export async function POST() {
  if (!demoEnabled()) {
    return NextResponse.json({ error: "Demo disabled" }, { status: 404 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_ADMIN_EMAIL,
    password: DEMO_PASSWORD,
  });

  if (error) {
    return NextResponse.json(
      { error: "Demo unavailable. Has the seed run?" },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, redirect: "/dashboard" });
}
