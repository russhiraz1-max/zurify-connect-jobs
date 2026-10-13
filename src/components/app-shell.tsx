import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  LayoutDashboard, ListChecks, FileCheck2, Wallet as WalletIcon, ArrowDownToLine, Briefcase,
  Bell, LifeBuoy, User as UserIcon, Settings as SettingsIcon, Send, Shield, BadgeCheck, Gift, Crown,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { cn } from "@/lib/utils";
import { useRoles } from "@/lib/roles";

const userNav = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/tasks", label: "Discover work", icon: ListChecks },
  { to: "/applications", label: "Applications", icon: Send },
  { to: "/submissions", label: "My submissions", icon: FileCheck2 },
  { to: "/wallet", label: "Wallet & earnings", icon: WalletIcon },
  { to: "/withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
  { to: "/verification", label: "Identity check", icon: BadgeCheck },
  { to: "/referrals", label: "Referrals", icon: Gift },
  { to: "/pro", label: "Zurify Pro", icon: Crown },
];

const accountNav = [
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/support", label: "Help & support", icon: LifeBuoy },
  { to: "/profile", label: "My profile", icon: UserIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({ children, title, subtitle }: { children: ReactNode; title?: string; subtitle?: string }) {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const navigate = useNavigate();
  const { isStaff, roles, loading: rolesLoading } = useRoles();
  const isEmployer = roles.includes("employer");
  const isWorkerRoute = userNav.some(item =>
    pathname === item.to || pathname.startsWith(item.to + "/"),
  );
  const isWorkerEligible = roles.includes("job_seeker")
    && roles.every(role => role === "user" || role === "job_seeker");
  const hasSpecialRole = roles.some(role =>
    ["super_admin", "staff", "admin", "advertiser"].includes(role),
  );
  const workerRouteBlocked = isWorkerRoute && (rolesLoading || !isWorkerEligible);

  useEffect(() => {
    if (rolesLoading || !isWorkerRoute || isWorkerEligible) return;
    const destination = isEmployer
      ? "/client-dashboard"
      : isStaff
        ? "/admin"
        : hasSpecialRole
          ? "/profile"
          : "/choose-account-type";
    void navigate({ to: destination as never, replace: true });
  }, [rolesLoading, isWorkerRoute, isWorkerEligible, isEmployer, isStaff, hasSpecialRole, navigate]);

  const navLink = (item: { to: string; label: string; icon: typeof LayoutDashboard }, compact = false) => {
    const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
    return (
      <Link
        key={item.to}
        to={item.to}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200",
          active
            ? "bg-gradient-to-r from-primary/15 via-violet-500/10 to-sky-500/10 font-semibold text-foreground ring-1 ring-inset ring-primary/15 shadow-sm"
            : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
          compact && "min-h-9",
        )}
      >
        <item.icon className={cn("h-[17px] w-[17px] shrink-0 transition-transform group-hover:scale-105", active ? "text-primary" : "text-muted-foreground")} />
        <span className="truncate">{item.label}</span>
        {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
      </Link>
    );
  };

  if (workerRouteBlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-workspace-glow px-4">
        <p className="text-sm text-muted-foreground">
          {rolesLoading ? "Checking your workspace permissions…" : "Opening the right workspace…"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-workspace-glow">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 gap-5 px-3 py-5 sm:px-5 lg:gap-7 lg:px-8 lg:py-7">
        <aside className="hidden w-[248px] shrink-0 lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-border/70 bg-card/85 p-3 shadow-sm backdrop-blur-xl">
            <div className="mb-3 rounded-xl bg-gradient-to-br from-primary/10 via-violet-500/10 to-sky-500/15 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Zurify workspace</p>
              <p className="mt-1 font-display text-sm font-semibold">{isEmployer ? "Create work. Track delivery." : "Find work. Get paid."}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{isEmployer ? "Manage your drafts and hiring workflow in one place." : "Your work, earnings and progress in one place."}</p>
            </div>
            <p className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/80">{isEmployer ? "Hiring workspace" : "Workspace"}</p>
            <nav className="space-y-1">
              {isEmployer
                ? navLink({ to: "/client-dashboard", label: "Client overview", icon: Briefcase })
                : userNav.map(item => navLink(item))}
            </nav>
            <div className="my-3 border-t border-border/70" />
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/80">Account</p>
            <nav className="space-y-1">
              {accountNav.map(item => navLink(item, true))}
            </nav>
            {isStaff && (
              <>
                <div className="my-3 border-t border-border/70" />
                <Link
                  to="/admin"
                  className={cn(
                    "flex min-h-10 items-center gap-3 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                    pathname.startsWith("/admin")
                      ? "border-primary/25 bg-primary/10 text-primary"
                      : "border-violet-500/20 bg-violet-500/5 text-violet-700 hover:bg-violet-500/10 dark:text-violet-300",
                  )}
                >
                  <Shield className="h-[17px] w-[17px]" /> Admin control center
                </Link>
              </>
            )}
            <div className="mt-4 rounded-xl border border-sky-500/15 bg-sky-500/5 px-3 py-2.5">
              <p className="text-xs font-semibold">{isEmployer ? "Your hiring workspace" : "Built for your next step"}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{isEmployer ? "Funding and publishing controls will appear when their secure workflows are ready." : "Discover opportunities, track progress and keep your account secure."}</p>
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          {title && (
            <div className="relative mb-6 overflow-hidden rounded-2xl border border-border/70 bg-card/75 px-5 py-5 shadow-sm backdrop-blur sm:px-7 sm:py-6">
              <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />
              <div className="pointer-events-none absolute right-20 top-0 h-28 w-28 rounded-full bg-sky-500/10 blur-3xl" />
              <div className="relative">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Your workspace</p>
                <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
                {subtitle && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
              </div>
            </div>
          )}
          <div className="min-w-0">{children}</div>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
