import AppShell from "@/components/AppShell";
import NewLeadClient from "./NewLeadClient";

export const metadata = { title: "New Lead · Rouxte" };

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ lat?: string; lng?: string; address?: string }>;
}) {
  const { lat, lng, address } = await searchParams;
  return (
    <AppShell>
      <NewLeadClient
        lat={lat ? Number(lat) : 0}
        lng={lng ? Number(lng) : 0}
        address={address}
      />
    </AppShell>
  );
}
