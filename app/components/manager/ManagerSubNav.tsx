"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRole } from "@/lib/types";

interface NavTab {
  href: string;
  label: string;
  roles: UserRole[];
}

const TABS: NavTab[] = [
  { href: "/manager/queue",      label: "Queue",      roles: ["admin", "sales_manager", "team_lead"] },
  { href: "/manager/team",       label: "My Team",    roles: ["admin", "sales_manager", "team_lead"] },
  { href: "/manager/teams",      label: "All Teams",  roles: ["admin", "sales_manager"] },
  { href: "/manager/people",     label: "People",     roles: ["admin", "sales_manager"] },
  { href: "/manager/goals",        label: "Goals",        roles: ["admin", "sales_manager", "team_lead"] },
  { href: "/manager/compensation", label: "Compensation", roles: ["admin", "sales_manager"] },
  { href: "/manager/onboarding",  label: "Onboarding",   roles: ["admin", "sales_manager", "team_lead"] },
  { href: "/manager/compliance",  label: "Compliance",   roles: ["admin", "sales_manager", "team_lead"] },
];

interface Props {
  role: UserRole;
}

export default function ManagerSubNav({ role }: Props) {
  const pathname = usePathname();
  const visible = TABS.filter((t) => t.roles.includes(role));

  return (
    <div className="flex gap-1 mb-6 border-b border-gray-100 pb-1 overflow-x-auto">
      {visible.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-blue-50 text-blue-700"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
