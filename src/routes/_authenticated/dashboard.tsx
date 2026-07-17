import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wallet, Clock, TrendingUp, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Zurify" }] }),
  component: DashboardPage,
});

type Wallet = { available_cents: number; pending_cents: number; lifetime_earned_cents: number; lifetime_withdrawn_cents: number };
type Task = { id: string; title: string; description: string; reward_cents: number; est_minutes: number | null };

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

function DashboardPage() {
  const { user } = useSession();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("wallets").select("available_cents,pending_cents,lifetime_earned_cents,lifetime_withdrawn_cents").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setWallet(data as Wallet | null));
    supabase.from("tasks").select("id,title,description,reward_cents,est_minutes").eq("status", "published").order("featured", { ascending: false }).limit(9)
      .then(({ data }) => setTasks((data ?? []) as Task[]));
  }, [user]);

  const stats = [
    { label: "Available balance", value: usd(wallet?.available_cents ?? 0), icon: Wallet },
    { label: "Pending", value: usd(wallet?.pending_cents ?? 0), icon: Clock },
    { label: "Lifetime earned", value: usd(wallet?.lifetime_earned_cents ?? 0), icon: TrendingUp },
    { label: "Lifetime withdrawn", value: usd(wallet?.lifetime_withdrawn_cents ?? 0), icon: ArrowUpRight },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Complete tasks below to grow your balance.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="grid h-11 w-11 place-items-center rounded-lg bg-brand-gradient text-primary-foreground">
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-xl font-semibold">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 flex items-end justify-between">
          <h2 className="font-display text-xl font-semibold">Available tasks</h2>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard">Refresh</Link>
          </Button>
        </div>

        {tasks.length === 0 ? (
          <Card className="mt-4"><CardContent className="p-10 text-center text-sm text-muted-foreground">No published tasks yet. Check back soon.</CardContent></Card>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tasks.map((t) => (
              <Card key={t.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold leading-tight">{t.title}</h3>
                    <Badge className="shrink-0 bg-brand-gradient text-primary-foreground">{usd(t.reward_cents)}</Badge>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{t.description}</p>
                  {t.est_minutes ? <p className="mt-3 text-xs text-muted-foreground">~{t.est_minutes} min</p> : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
