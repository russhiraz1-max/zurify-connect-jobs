import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard, ListChecks, FileCheck2, Wallet as WalletIcon, ArrowDownToLine,
  Bell, LifeBuoy, User as UserIcon, Settings as SettingsIcon, Send, Shield, BadgeCheck, Gift,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { cn } from "@/lib/utils";
import { useRoles } from "@/lib/roles";

const userNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tasks", label: "Browse jobs", icon: ListChecks },
  { to: "/applications", label: "Applications", icon: Send },
  { to: "/submissions", label: "Submissions", icon: FileCheck2 },
  { to: "/wallet", label: "Wallet", icon: WalletIcon },
  { to: "/withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
  { to: "/verification", label: "Verification", icon: BadgeCheck },
  { to: "/referrals", label: "Referrals", icon: Gift },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/support", label: "Support", icon: LifeBuoy },
  { to: "/profile", label: "Profile", icon: UserIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({ children, title, subtitle }: { children: ReactNode; title?: string; subtitle?: string }) {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const { isStaff } = useRoles();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-20 space-y-0.5">
            {userNav.map(item => {
              const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
              return (
                <Link key={item.to} to={item.to}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}>
                  <item.icon className="h-4 w-4" /> {item.label}
                </Link>
              );
            })}
            {isStaff && (
              <Link to="/admin"
                className={cn(
                  "mt-2 flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10",
                  pathname.startsWith("/admin") && "bg-primary/10",
                )}>
                <Shield className="h-4 w-4" /> Admin
              </Link>
            )}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">
          {title && (
            <div className="mb-6">
              <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          )}
          {children}
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
