import ManagerShell from "@/app/components/manager/ManagerShell";
import PayrollPanel from "@/app/components/manager/PayrollPanel";

export default async function ManagerPayrollPage() {
  return (
    <ManagerShell>
      <PayrollPanel />
    </ManagerShell>
  );
}
