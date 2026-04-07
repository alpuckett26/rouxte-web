"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProfile } from "@/lib/hooks/useProfile";
import { UserRole } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: UserRole[]; // undefined = all roles
}

const MapIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
);

const LeadsIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const DashIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const PayIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const TeamIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const ManagerIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const TrainingIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const CoachIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const ALL_NAV: NavItem[] = [
  { href: "/map",           label: "Map",      icon: <MapIcon /> },
  { href: "/leads",         label: "Leads",    icon: <LeadsIcon /> },
  { href: "/dashboard",     label: "Home",     icon: <DashIcon /> },
  { href: "/coach",         label: "Coach",    icon: <CoachIcon /> },
  { href: "/training",      label: "Training", icon: <TrainingIcon /> },
  { href: "/payroll",       label: "Pay",      icon: <PayIcon />,     roles: ["sales_rep", "team_lead"] },
  // Team leads see a lightweight team view
  { href: "/manager/team",  label: "Team",     icon: <TeamIcon />,    roles: ["team_lead"] },
  // Managers + admins see full manager suite
  { href: "/manager/queue", label: "Manager",  icon: <ManagerIcon />, roles: ["sales_manager", "admin"] },
];

function getNavForRole(role: UserRole | undefined): NavItem[] {
  if (!role) return ALL_NAV.filter((n) => !n.roles); // show generic items while loading
  return ALL_NAV.filter((n) => !n.roles || n.roles.includes(role));
}

export default function AppShell({
  children,
  mapMode,
}: {
  children: React.ReactNode;
  mapMode?: boolean;
}) {
  const pathname = usePathname();
  const { profile } = useProfile();
  const navItems = getNavForRole(profile?.role);

  // Role badge shown in header for elevated roles
  const roleBadge: Partial<Record<UserRole, string>> = {
    admin: "Owner",
    sales_manager: "Manager",
    team_lead: "Team Lead",
  };

  const header = (
    <header className="shrink-0 relative z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 h-14">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img src="/logo.svg" alt="Rouxte" className="h-7" />
          {profile?.role && roleBadge[profile.role] && (
            <span className="hidden sm:inline text-xs font-semibold rounded-full bg-blue-100 text-blue-700 px-2 py-0.5">
              {roleBadge[profile.role]}
            </span>
          )}
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link href="/settings" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
      </div>
    </header>
  );

  const mobileNav = (
    <nav
      className="md:hidden shrink-0 border-t border-gray-200 bg-white/90 backdrop-blur-sm"
      style={{ display: "grid", gridTemplateColumns: `repeat(${navItems.length}, 1fr)` }}
    >
      {navItems.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
              active ? "text-blue-600" : "text-gray-500"
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  if (mapMode) {
    // Full-height flex column: header + map fills remaining + in-flow mobile nav
    // This gives the map a precise height without overflow or fixed nav overlap
    return (
      <div className="h-dvh flex flex-col bg-gray-50 overflow-hidden">
        {header}
        <main className="flex-1 min-h-0 relative z-10 md:mx-auto md:w-full md:max-w-6xl md:px-4 md:py-6">
          {children}
        </main>
        {mobileNav}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {header}
      {/* pb-16 md:pb-0 keeps content above the fixed mobile nav */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6 pb-20 md:pb-6">
        {children}
      </main>
      {/* Fixed bottom nav for normal pages */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white/90 backdrop-blur-sm"
        style={{ display: "grid", gridTemplateColumns: `repeat(${navItems.length}, 1fr)` }}
      >
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
                active ? "text-blue-600" : "text-gray-500"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
