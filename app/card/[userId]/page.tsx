import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import QRCode from "qrcode";
import CardActions from "./CardActions";

interface Params { params: Promise<{ userId: string }> }

const ROLE_LABELS: Record<string, string> = {
  sales_rep: "Sales Representative",
  team_lead: "Team Lead",
  sales_manager: "Sales Manager",
  admin: "Account Manager",
};

export default async function CardPage({ params }: Params) {
  const { userId } = await params;
  const admin = createAdminClient();

  const [profileResult, authResult] = await Promise.all([
    admin.from("user_profiles")
      .select("full_name, phone, org_id, role, avatar_url, card_enabled")
      .eq("user_id", userId)
      .maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ]);

  const profile = profileResult.data;
  if (!profile || profile.card_enabled === false) notFound();

  const email = authResult.data?.user?.email ?? "";
  const { data: org } = await admin.from("orgs").select("name").eq("id", profile.org_id).single();
  const orgName = org?.name ?? "";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://rouxte.com";
  const cardUrl = `${appUrl}/card/${userId}`;
  const vcfUrl = `/api/card/${userId}/vcf`;

  const qrDataUrl = await QRCode.toDataURL(cardUrl, {
    width: 160,
    margin: 1,
    color: { dark: "#0a0f1e", light: "#ffffff" },
  });

  const name = profile.full_name ?? "Rep";
  const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const title = ROLE_LABELS[profile.role] ?? "Sales Representative";

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-start py-12 px-4">
      <div className="w-full max-w-sm flex flex-col items-center">

        {/* Rouxte wordmark */}
        <div className="mb-8 text-2xl font-black tracking-tight">
          <span className="text-[#1BAEE1]">ROU</span>
          <span className="text-[#72C41A]">X</span>
          <span className="text-[#1BAEE1]">TE</span>
        </div>

        {/* Avatar */}
        <div className="relative mb-5">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={name}
              className="h-28 w-28 rounded-full object-cover ring-4 ring-white/10"
            />
          ) : (
            <div className="h-28 w-28 rounded-full bg-gradient-to-br from-[#1BAEE1] to-[#0d7fa6] ring-4 ring-white/10 flex items-center justify-center">
              <span className="text-3xl font-bold text-white">{initials}</span>
            </div>
          )}
        </div>

        {/* Identity */}
        <h1 className="text-2xl font-bold text-white mb-1">{name}</h1>
        <p className="text-sm text-white/60 mb-1">{title}</p>
        <p className="text-sm font-semibold text-[#1BAEE1] mb-8">{orgName}</p>

        {/* Contact chips */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {profile.phone && (
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 border border-white/10 px-3 py-1 text-xs text-white/80">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z" />
              </svg>
              {profile.phone}
            </span>
          )}
          {email && (
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 border border-white/10 px-3 py-1 text-xs text-white/80">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {email}
            </span>
          )}
        </div>

        {/* Interactive actions */}
        <CardActions
          userId={userId}
          name={name}
          phone={profile.phone}
          email={email}
          vcfUrl={vcfUrl}
          cardUrl={cardUrl}
        />

        {/* QR code */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="rounded-2xl bg-white p-3 shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR code" className="h-32 w-32" />
          </div>
          <p className="text-xs text-white/30">Scan to view this card</p>
        </div>

        {/* Footer */}
        <p className="mt-10 text-xs text-white/20">Powered by Rouxte</p>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: Params) {
  const { userId } = await params;
  const admin = createAdminClient();
  const { data } = await admin.from("user_profiles").select("full_name").eq("user_id", userId).maybeSingle();
  return {
    title: data?.full_name ? `${data.full_name} | Rouxte` : "Digital Card | Rouxte",
  };
}
