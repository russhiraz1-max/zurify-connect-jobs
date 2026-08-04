import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight, BadgeCheck, CheckCircle2, DollarSign, Gift, Layers, LockKeyhole,
  ShieldCheck, Sparkles, Timer, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { usd } from "@/lib/format";
import { jobTypeLabel, JOB_TYPES } from "@/lib/jobs";
import { categoryTint } from "@/routes/_authenticated/admin/categories";

const SITE = "https://zurify-connect-jobs.lovable.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zurify — Freelance jobs, gigs and paid micro tasks" },
      { name: "description", content: "Zurify is a freelancing marketplace for micro tasks, gigs, freelance projects and remote work. Get paid in USD with fast PayPal payouts." },
      { property: "og:title", content: "Zurify — Freelance jobs, gigs and paid micro tasks" },
      { property: "og:description", content: "Find paid work that fits you: micro tasks, gigs, freelance projects and remote opportunities. Fast PayPal payouts from $3." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: SITE }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Zurify",
          url: SITE,
          description: "Freelancing marketplace for micro tasks, gigs, freelance projects and remote work.",
        }),
      },
    ],
  }),
  component: LandingPage,
});

type FeaturedJob = {
  id: string; title: string; description: string; reward_cents: number;
  est_minutes: number | null; job_type: string; is_urgent: boolean; featured: boolean;
};
type Cat = { id: string; name: string; slug: string; description: string | null; color: string; job_count: number };

function LandingPage() {
  const { user } = useSession();
  const [jobs, setJobs] = useState<FeaturedJob[] | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);

  useEffect(() => {
    supabase
      .from("tasks")
      .select("id,title,description,reward_cents,est_minutes,job_type,is_urgent,featured")
      .eq("status", "published")
      .order("featured", { ascending: false })
      .order("priority", { ascending: false })
      .limit(6)
      .then(({ data }) => setJobs((data ?? []) as unknown as FeaturedJob[]));
    supabase.rpc("get_job_categories" as never).then(({ data }) => setCats(((data ?? []) as unknown as Cat[]).slice(0, 12)));
  }, []);

  const browseTo = user ? "/tasks" : "/auth";
  const startTo = user ? "/dashboard" : "/auth";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 -z-10 bg-brand-gradient opacity-10" />
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="secondary" className="mb-6">
                <Sparkles className="mr-1 h-3 w-3" /> Micro tasks · Gigs · Freelance projects · Remote work
              </Badge>
              <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
                Find work. <span className="bg-brand-gradient bg-clip-text text-transparent">Get paid.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
                Zurify is a freelancing marketplace where every job — from a two-minute micro task to a full freelance
                project — pays real USD straight into your wallet. Withdraw to PayPal from just $3.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button asChild size="lg">
                  <Link to={startTo} {...(user ? {} : { search: { mode: "signup" } as never })}>
                    {user ? "Go to dashboard" : "Start earning"} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to={browseTo}>Browse jobs</Link>
                </Button>
              </div>
              <div className="mt-10 grid grid-cols-2 gap-4 text-left sm:grid-cols-4">
                {[
                  { icon: Layers, label: "Job types", value: `${JOB_TYPES.length}` },
                  { icon: Users, label: "Categories", value: `${cats.length || 27}+` },
                  { icon: DollarSign, label: "Min payout", value: "$3" },
                  { icon: Timer, label: "Payout time", value: "48h" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-border bg-card/60 p-4">
                    <s.icon className="h-4 w-4 text-primary" />
                    <p className="mt-2 text-xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Marketplace overview */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">One marketplace, every kind of work</h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Whatever your skill level, there is a way to earn on Zurify.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {JOB_TYPES.map((t) => (
              <Card key={t.value}>
                <CardContent className="p-5">
                  <h3 className="font-semibold">{t.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t.blurb}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Categories */}
        {cats.length > 0 && (
          <section className="border-y border-border bg-muted/30">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
              <div className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
                <div className="min-w-0">
                  <h2 className="font-display text-2xl font-bold sm:text-3xl">Popular categories</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Explore the skills clients are hiring for right now.</p>
                </div>
                <Button asChild variant="ghost" className="shrink-0">
                  <Link to={browseTo}>All <ArrowRight className="ml-1 h-4 w-4" /></Link>
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {cats.map((c) => (
                  <Link key={c.id} to={browseTo} className="group block">
                    <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
                      <CardContent className="p-4">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                          <p className="truncate font-medium">{c.name}</p>
                          <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs ${categoryTint(c.color)}`}>
                            {c.job_count}
                          </span>
                        </div>
                        {c.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Open jobs */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <div className="min-w-0">
              <h2 className="font-display text-2xl font-bold sm:text-3xl">Open jobs</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {user ? "Open a job to apply and submit your work." : "Create a free account to apply and start earning."}
              </p>
            </div>
            <Button asChild variant="ghost" className="shrink-0">
              <Link to={browseTo}>See all <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
          {jobs === null ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <Card key={i}><CardContent className="h-40 animate-pulse p-6" /></Card>)}
            </div>
          ) : jobs.length === 0 ? (
            <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">New jobs arriving soon. Create an account to be notified first.</CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {jobs.map((t) => (
                <Card key={t.id} className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="p-5">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium uppercase tracking-wide text-primary">{jobTypeLabel(t.job_type)}</p>
                        <h3 className="mt-1 line-clamp-2 font-semibold leading-snug">{t.title}</h3>
                      </div>
                      <Badge className="shrink-0 bg-brand-gradient text-primary-foreground">{usd(t.reward_cents)}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{t.description}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {t.est_minutes ? <span>~{t.est_minutes} min</span> : null}
                      {t.is_urgent && <Badge variant="destructive">Urgent</Badge>}
                      {t.featured && <Badge variant="secondary">Featured</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* How it works */}
        <section className="border-y border-border bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="text-center font-display text-2xl font-bold sm:text-3xl">How Zurify works</h2>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { n: "1", t: "Find a job", d: "Browse micro tasks, gigs, projects and remote roles." },
                { n: "2", t: "Apply", d: "Send a short cover letter and your experience." },
                { n: "3", t: "Deliver", d: "Once approved, complete the work and submit your proof." },
                { n: "4", t: "Get paid", d: "Approved work credits your wallet — withdraw from $3." },
              ].map((s) => (
                <li key={s.n}>
                  <Card className="h-full">
                    <CardContent className="p-5">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-gradient font-bold text-primary-foreground">{s.n}</div>
                      <h3 className="mt-3 font-semibold">{s.t}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Why choose / trust */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-center font-display text-2xl font-bold sm:text-3xl">Why choose Zurify</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: DollarSign, title: "Real USD rewards", body: "Every approved job credits real money to your wallet — no points, no vouchers." },
              { icon: ShieldCheck, title: "Manually reviewed", body: "Our team reviews every submission so quality work is fairly rewarded." },
              { icon: CheckCircle2, title: "$3 minimum payout", body: "Withdraw to PayPal from $3. Payments are processed within 48 hours." },
              { icon: BadgeCheck, title: "Identity verification", body: "Verified identities keep the marketplace trustworthy and payouts safe." },
              { icon: LockKeyhole, title: "Secure by design", body: "Row-level security, encrypted document storage and full audit logging." },
              { icon: Gift, title: "Referral program", body: "Invite friends for a welcome bonus plus lifetime commission on their earnings." },
            ].map((v) => (
              <Card key={v.title}>
                <CardContent className="p-5">
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

        {/* Referral CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <Card className="overflow-hidden">
            <CardContent className="grid gap-6 p-6 sm:p-10 lg:grid-cols-[minmax(0,2fr)_auto] lg:items-center">
              <div className="min-w-0">
                <Badge variant="secondary" className="mb-3"><Gift className="mr-1 h-3 w-3" /> Referral program</Badge>
                <h2 className="font-display text-2xl font-bold">Earn while your friends earn</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Share your personal referral code. Your friend gets a welcome bonus after their first approved job, and
                  you earn ongoing commission on their withdrawals. Climb the public leaderboard for extra rewards.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild><Link to={user ? "/referrals" : "/auth"}>{user ? "My referrals" : "Join Zurify"}</Link></Button>
                <Button asChild variant="outline"><Link to="/referrals/leaderboard">Leaderboard</Link></Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 lg:px-8">
          <h2 className="text-center font-display text-2xl font-bold sm:text-3xl">Frequently asked questions</h2>
          <Accordion type="single" collapsible className="mt-8">
            {[
              { q: "Is Zurify free to join?", a: "Yes. Creating an account, browsing jobs and applying is completely free." },
              { q: "What kinds of work can I find?", a: "Micro tasks, gigs, freelance projects, remote opportunities, service requests and contests — all in one marketplace." },
              { q: "How and when do I get paid?", a: "Approved work credits your Zurify wallet instantly. You can request a PayPal withdrawal from $3, processed within 48 hours." },
              { q: "Why do I need to verify my identity?", a: "Identity verification protects the marketplace from fraud and is required before your first withdrawal." },
              { q: "How does the referral program work?", a: "Share your referral code. Your friend receives a welcome bonus after their first approved job and you earn commission on their withdrawals." },
            ].map((f, i) => (
              <AccordionItem key={f.q} value={`item-${i}`}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-10 text-center">
            <Button asChild size="lg">
              <Link to={startTo} {...(user ? {} : { search: { mode: "signup" } as never })}>
                {user ? "Go to dashboard" : "Create your free account"} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
