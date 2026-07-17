import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, DollarSign, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zurify — Complete tasks. Get paid." },
      { name: "description", content: "Earn real money completing simple online tasks. Fast payouts via PayPal. Join Zurify today." },
      { property: "og:title", content: "Zurify — Complete tasks. Get paid." },
      { property: "og:description", content: "Earn real money completing simple online tasks. Fast payouts via PayPal." },
    ],
  }),
  component: LandingPage,
});

type FeaturedTask = { id: string; title: string; description: string; reward_cents: number; est_minutes: number | null };

function formatUSD(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function LandingPage() {
  const [tasks, setTasks] = useState<FeaturedTask[]>([]);

  useEffect(() => {
    supabase
      .from("tasks")
      .select("id,title,description,reward_cents,est_minutes")
      .eq("status", "published")
      .order("featured", { ascending: false })
      .order("priority", { ascending: false })
      .limit(6)
      .then(({ data }) => setTasks((data ?? []) as FeaturedTask[]));
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-brand-gradient opacity-10" />
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="secondary" className="mb-6">
                <Sparkles className="mr-1 h-3 w-3" /> Get paid for simple tasks
              </Badge>
              <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
                Complete tasks. <span className="bg-brand-gradient bg-clip-text text-transparent">Get paid.</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground">
                Zurify pays you in real USD for completing small online tasks. Withdraw to PayPal starting at just $3.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button asChild size="lg">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Start earning <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/how-it-works">How it works</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Value props */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { icon: DollarSign, title: "Real USD rewards", body: "Every task pays real money credited to your wallet on approval." },
              { icon: ShieldCheck, title: "Manually reviewed", body: "Our team reviews every submission to keep the platform trustworthy." },
              { icon: CheckCircle2, title: "$3 minimum payout", body: "Withdraw to PayPal starting at $3. Payments sent within 48 hours." },
            ].map((v) => (
              <Card key={v.title}>
                <CardContent className="p-6">
                  <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-brand-gradient text-primary-foreground">
                    <v.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold">{v.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{v.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Featured tasks */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold sm:text-3xl">Available tasks</h2>
              <p className="mt-2 text-sm text-muted-foreground">Sign in to submit and earn.</p>
            </div>
            <Button asChild variant="ghost">
              <Link to="/auth">
                See all <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          {tasks.length === 0 ? (
            <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">New tasks arriving soon. Create an account to be notified.</CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tasks.map((t) => (
                <Card key={t.id} className="transition-shadow hover:shadow-md">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold leading-tight">{t.title}</h3>
                      <Badge className="shrink-0 bg-brand-gradient text-primary-foreground">{formatUSD(t.reward_cents)}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{t.description}</p>
                    {t.est_minutes ? <p className="mt-3 text-xs text-muted-foreground">~{t.est_minutes} min</p> : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
