import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Shield, LayoutDashboard, ListChecks, Send, FileCheck2, ArrowDownToLine,
  Users, UserCog, Tag, Flag, Megaphone, ScrollText, Settings as SettingsIcon,
  LifeBuoy, Bell,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/tasks", label: "Tasks", icon: ListChecks },
  { to: "/admin/applications", label: "Applications", icon: Send },
  { to: "/admin/submissions", label: "Submissions", icon: FileCheck2 },
  { to: "/admin/withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/staff", label: "Staff", icon: UserCog },
  { to: "/admin/categories", label: "Categories", icon: Tag },
  { to: "/admin/reports", label: "Reports", icon: Flag },
  { to: "/admin/tickets", label: "Support", icon: LifeBuoy },
  { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/audit-logs", label: "Audit logs", icon: ScrollText },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

export function AdminShell({ children, title, subtitle }: { children: ReactNode; title?: string; subtitle?: string }) {
  const pathname = useRouterState({ select: s => s.location.pathname });
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-20 space-y-1">
            <div className="mb-3 flex items-center gap-2 rounded-md bg-brand-gradient px-3 py-2 text-primary-foreground">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-semibold">Admin Console</span>
            </div>
            {nav.map(item => {
              const active = item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");
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
          </div>
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
