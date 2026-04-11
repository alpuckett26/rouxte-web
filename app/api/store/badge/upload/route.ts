import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/store/badge/upload
// Accepts a base64 data URL from the badge canvas, uploads to Supabase Storage
// and returns a public URL suitable for Printful to fetch.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { image_data_url } = await request.json();
  if (!image_data_url?.startsWith("data:image/")) {
    return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
  }

  // Strip the data URL prefix and decode to buffer
  const base64 = image_data_url.split(",")[1];
  const buffer = Buffer.from(base64, "base64");

  const fileName = `badges/${user.id}/${Date.now()}.png`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from("store-assets")
    .upload(fileName, buffer, {
      contentType:   "image/png",
      upsert:        true,
      cacheControl:  "3600",
    });

  if (error) {
    // If bucket doesn't exist yet, return data URL as fallback for digital downloads
    console.error("Storage upload error:", error.message);
    return NextResponse.json({ url: image_data_url });
  }

  const { data: { publicUrl } } = admin.storage
    .from("store-assets")
    .getPublicUrl(fileName);

  return NextResponse.json({ url: publicUrl });
}
