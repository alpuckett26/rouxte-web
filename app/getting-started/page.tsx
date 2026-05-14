import AppShell from "@/components/AppShell";
import GettingStartedClient from "./GettingStartedClient";

export const metadata = {
  title: "Getting Started · Rouxte",
};

export default function GettingStartedPage() {
  return (
    <AppShell>
      <GettingStartedClient />
    </AppShell>
  );
}
