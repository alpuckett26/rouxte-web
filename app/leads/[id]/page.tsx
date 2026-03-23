import AppShell from "@/components/AppShell";
import LeadDetailView from "@/components/leads/LeadDetailView";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <AppShell>
      <LeadDetailView leadId={id} />
    </AppShell>
  );
}
