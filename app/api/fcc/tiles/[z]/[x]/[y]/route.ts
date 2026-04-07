import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const { z, x, y } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("fcc_att_mvt", {
    z: parseInt(z),
    x: parseInt(x),
    y: parseInt(y),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Empty tile
  if (!data) return new Response(null, { status: 204 });

  // data is a hex string from Supabase — decode to binary
  const hex = typeof data === "string" ? data : Buffer.from(data).toString("hex");
  const buf = Buffer.from(hex.replace(/^\\x/, ""), "hex");

  return new Response(buf, {
    headers: {
      "Content-Type": "application/x-protobuf",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
