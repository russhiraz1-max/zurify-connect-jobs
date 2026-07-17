import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, Briefcase, Rocket, Search, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense } from "react";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(featuredJobsQuery);
  },
  component: LandingPage,
});

const featuredJobsQuery = {
  queryKey: ["featured-jobs"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("jobs")
      .select("id,title,company,location,remote,employment_type,salary_min,salary_max,tags")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(6);
    if (error) throw error;
    return data ?? [];
  },
};

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Stats />
        <Suspense fallback={null}>
          <FeaturedJobs />
        </Suspense>
        <ForEmployers />
        <CTA />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-hero-radial">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-6 sm:pt-28 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="mb-6 gap-1.5 rounded-full border border-border/60 bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            Now hiring across 2,400+ companies
          </Badge>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl">
            The modern way to <span className="bg-brand-gradient bg-clip-text text-transparent">find work you love</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Zurify connects thoughtful, ambitious people with companies building the future. Curated roles, transparent salaries, one-click apply.
          </p>
          <div className="mx-auto mt-10 flex max-w-xl flex-col items-stretch gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 px-6 text-base">
              <Link to="/jobs">
                <Search className="mr-2 h-4 w-4" /> Browse jobs
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
              <Link to="/auth" search={{ mode: "signup" }}>Create free account</Link>
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-primary" /> Vetted companies</span>
            <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-primary" /> Salary transparency</span>
            <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-primary" /> Free forever</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const stats = [
    { label: "Active roles", value: "12,400+" },
    { label: "Companies", value: "2,400" },
    { label: "Avg. time to offer", value: "18 days" },
    { label: "Candidate rating", value: "4.9 / 5" },
  ];
  return (
    <section className="border-y border-border/60 bg-surface">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-4 sm:px-6 lg:px-8">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="font-display text-2xl font-bold text-foreground sm:text-3xl">{s.value}</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeaturedJobs() {
  const qc = useQueryClient();
  const { data: jobs } = useSuspenseQuery({ ...featuredJobsQuery, queryClient: qc } as typeof featuredJobsQuery);

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mb-10 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight">Featured openings</h2>
          <p className="mt-2 text-muted-foreground">Fresh roles from teams we love.</p>
        </div>
        <Button asChild variant="ghost" className="hidden sm:inline-flex">
          <Link to="/jobs">View all <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => (
          <Link
            key={job.id}
            to="/jobs/$id"
            params={{ id: job.id }}
            className="group flex flex-col rounded-2xl border border-border/70 bg-surface p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                <Briefcase className="h-5 w-5" />
              </div>
              {job.remote && <Badge variant="secondary" className="rounded-full">Remote</Badge>}
            </div>
            <div className="text-sm font-medium text-muted-foreground">{job.company}</div>
            <div className="mt-1 font-display text-lg font-semibold group-hover:text-primary">{job.title}</div>
            <div className="mt-1 text-sm text-muted-foreground">{job.location} · {job.employment_type}</div>
            {job.salary_min && job.salary_max && (
              <div className="mt-3 text-sm font-medium text-foreground">
                ${job.salary_min.toLocaleString()} – ${job.salary_max.toLocaleString()}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(job.tags ?? []).slice(0, 3).map((t) => (
                <span key={t} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">{t}</span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ForEmployers() {
  const features = [
    { icon: Users, title: "Reach quality candidates", body: "Post roles and reach thousands of engaged, vetted job seekers." },
    { icon: Rocket, title: "Hire faster", body: "Track applications, coordinate interviews, and make offers in one place." },
    { icon: BadgeCheck, title: "Transparent by default", body: "Salary ranges and structured job posts build trust with candidates." },
  ];
  return (
    <section className="bg-surface-muted/50">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight">Built for teams that hire well</h2>
          <p className="mt-3 text-muted-foreground">Zurify gives employers everything they need to attract and hire the right people, quickly.</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border/70 bg-surface p-6">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl bg-brand-gradient p-10 text-primary-foreground sm:p-16">
        <div className="relative z-10 mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Your next role is one click away</h2>
          <p className="mt-3 text-primary-foreground/85">Create a free Zurify profile and start applying today.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary" className="h-12 px-6 text-base">
              <Link to="/auth" search={{ mode: "signup" }}>Create account</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 border-primary-foreground/30 bg-transparent px-6 text-base text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/jobs">Browse jobs</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
