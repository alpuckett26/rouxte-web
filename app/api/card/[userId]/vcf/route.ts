import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Params { params: Promise<{ userId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await params;
  const admin = createAdminClient();

  const [profileResult, authResult] = await Promise.all([
    admin.from("user_profiles")
      .select("full_name, phone, org_id, role, card_enabled")
      .eq("user_id", userId)
      .maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ]);

  const profile = profileResult.data;
  if (!profile || profile.card_enabled === false) {
    return new NextResponse("Not found", { status: 404 });
  }

  const email = authResult.data?.user?.email ?? "";
  const { data: org } = await admin.from("orgs").select("name").eq("id", profile.org_id).single();
  const orgName = org?.name ?? "";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://rouxte.com";
  const cardUrl = `${appUrl}/card/${userId}`;

  const ROLE_LABELS: Record<string, string> = {
    sales_rep: "Sales Representative",
    team_lead: "Team Lead",
    sales_manager: "Sales Manager",
    admin: "Account Manager",
  };
  const title = ROLE_LABELS[profile.role] ?? "Sales Representative";

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${profile.full_name ?? ""}`,
    `N:${(profile.full_name ?? "").split(" ").reverse().join(";")};;;`,
    `ORG:${orgName}`,
    `TITLE:${title}`,
    profile.phone ? `TEL;TYPE=CELL:${profile.phone}` : null,
    email ? `EMAIL;TYPE=WORK:${email}` : null,
    `URL:${cardUrl}`,
    "END:VCARD",
  ].filter(Boolean).join("\r\n");

  return new NextResponse(lines, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${(profile.full_name ?? "contact").replace(/\s+/g, "_")}.vcf"`,
    },
  });
}
