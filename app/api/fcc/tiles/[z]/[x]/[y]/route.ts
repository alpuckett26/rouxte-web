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

  if (error) {
    console.error("[MVT] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Empty tile (no features in this tile)
  if (!data) return new Response(null, { status: 204 });

  console.log("[MVT] tile", z, x, y, "data type:", typeof data, "length:", String(data).length);

  // Supabase returns bytea as a base64 string via PostgREST
  let buf: Buffer;
  if (typeof data === "string") {
    // Could be base64 or \x-prefixed hex
    if (data.startsWith("\\x")) {
      buf = Buffer.from(data.replace(/^\\x/, ""), "hex");
    } else {
      buf = Buffer.from(data, "base64");
    }
  } else {
    buf = Buffer.from(data);
  }

  if (buf.length === 0) return new Response(null, { status: 204 });

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/x-protobuf",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
