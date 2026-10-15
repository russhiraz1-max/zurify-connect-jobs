import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  Briefcase, LayoutDashboard, LogOut, Settings as SettingsIcon, User as UserIcon, Shield, Bell, Gift,
  Menu, ListChecks, Send, FileCheck2, Wallet as WalletIcon, ArrowDownToLine, BadgeCheck, LifeBuoy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { useRoles } from "@/lib/roles";
import { cn } from "@/lib/utils";

function initials(name?: string | null, email?: string | null) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+|@/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

export const authedNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tasks", label: "Browse tasks", icon: ListChecks },
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

const clientAuthedNav = [
  { to: "/client-dashboard", label: "Client workspace", icon: Briefcase },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/support", label: "Support", icon: LifeBuoy },
  { to: "/profile", label: "Profile", icon: UserIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const aiCompanyAuthedNav = [
  { to: "/ai-workspace", label: "AI workspace", icon: LayoutDashboard },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/support", label: "Support", icon: LifeBuoy },
  { to: "/profile", label: "Profile", icon: UserIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const publicNav = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/faq", label: "FAQ" },
  { to: "/referrals/leaderboard", label: "Leaderboard" },
  { to: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const { user } = useSession();
  const { isStaff, roles } = useRoles();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const navItem = (to: string, label: string) => {
    const active = pathname === to || (to !== "/" && pathname.startsWith(to));
    return (
      <Link key={to} to={to}
        className={"text-sm font-medium transition-colors " + (active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
        {label}
      </Link>
    );
  };

  const name = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-ml-2 md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] max-w-xs overflow-y-auto p-0">
              <SheetHeader className="border-b border-border px-4 py-4 text-left">
                <SheetTitle className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-primary-foreground">
                    <Briefcase className="h-4 w-4" />
                  </span>
                  Zurify
                </SheetTitle>
              </SheetHeader>
              <nav className="space-y-0.5 p-3">
                {user ? (
                  <>
                    {(roles.includes("ai_company") ? aiCompanyAuthedNav : roles.includes("ai_company") ? aiCompanyAuthedNav : roles.includes("employer") ? clientAuthedNav : authedNav).map((item) => {
                      const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
                      return (
                        <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)}
                          className={cn(
                            "flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                            active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                          )}>
                          <item.icon className="h-4 w-4" /> {item.label}
                        </Link>
                      );
                    })}
                    {isStaff && (
                      <Link to="/admin" onClick={() => setMenuOpen(false)}
                        className="mt-2 flex min-h-11 items-center gap-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm font-medium text-primary">
                        <Shield className="h-4 w-4" /> Admin console
                      </Link>
                    )}
                    <button onClick={() => { setMenuOpen(false); void signOut(); }}
                      className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10">
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </>
                ) : (
                  <>
                    {publicNav.map((item) => (
                      <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)}
                        className="flex min-h-11 items-center rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground">
                        {item.label}
                      </Link>
                    ))}
                    <div className="mt-3 space-y-2 px-1">
                      <Button asChild variant="outline" className="w-full" onClick={() => setMenuOpen(false)}>
                        <Link to="/auth">Sign in</Link>
                      </Button>
                      <Button asChild className="w-full" onClick={() => setMenuOpen(false)}>
                        <Link to="/auth" search={{ mode: "signup" }}>Get started</Link>
                      </Button>
                    </div>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>

          <Link to="/" className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-gradient text-primary-foreground shadow-sm">
              <Briefcase className="h-4 w-4" />
            </span>
            <span className="truncate font-display text-lg font-bold tracking-tight">Zurify</span>
          </Link>
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          {!user && publicNav.slice(0, 3).map((i) => navItem(i.to, i.label))}
          {user && (roles.includes("employer")
            ? navItem("/client-dashboard", "Client workspace")
            : <>
                {navItem("/dashboard", "Dashboard")}
                {navItem("/tasks", "Tasks")}
                {navItem("/wallet", "Wallet")}
              </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button asChild variant="ghost" size="icon" className="relative">
                <Link to="/notifications" aria-label="Notifications"><Bell className="h-4 w-4" /></Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full border border-border bg-surface px-1.5 py-1 pr-3 transition-colors hover:bg-accent">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-brand-gradient text-xs font-semibold text-primary-foreground">
                        {initials(name, user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-[140px] truncate text-sm font-medium sm:inline">{name}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate({ to: "/dashboard" })}>
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate({ to: "/profile" })}>
                    <UserIcon className="mr-2 h-4 w-4" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate({ to: "/referrals" })}>
                    <Gift className="mr-2 h-4 w-4" /> Referrals
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate({ to: "/settings" })}>
                    <SettingsIcon className="mr-2 h-4 w-4" /> Settings
                  </DropdownMenuItem>
                  {isStaff && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => navigate({ to: "/admin" })}>
                        <Shield className="mr-2 h-4 w-4" /> Admin console
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={signOut} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth" search={{ mode: "signup" }}>Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
