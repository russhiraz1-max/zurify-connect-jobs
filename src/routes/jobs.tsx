import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Briefcase, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";

const jobsQuery = {
  queryKey: ["jobs", "all"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("jobs")
      .select("id,title,company,location,remote,employment_type,salary_min,salary_max,tags,description,created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
};

export const Route = createFileRoute("/jobs")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(jobsQuery);
  },
  head: () => ({
    meta: [
      { title: "Browse jobs — Zurify" },
      { name: "description", content: "Browse thousands of open roles at top companies on Zurify." },
    ],
  }),
  component: JobsPage,
});

function JobsPage() {
  const { data: jobs } = useSuspenseQuery(jobsQuery);
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      const matchQ = !q || `${j.title} ${j.company} ${(j.tags ?? []).join(" ")}`.toLowerCase().includes(q.toLowerCase());
      const matchL = !loc || j.location.toLowerCase().includes(loc.toLowerCase());
      const matchR = !remoteOnly || j.remote;
      return matchQ && matchL && matchR;
    });
  }, [jobs, q, loc, remoteOnly]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="border-b border-border/60 bg-surface-muted/50">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Find your next role</h1>
            <p className="mt-2 text-muted-foreground">{jobs.length} open positions across the Zurify network.</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, company, or keyword" className="h-11 pl-9" />
              </div>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Location" className="h-11 pl-9" />
              </div>
              <Button
                type="button"
                variant={remoteOnly ? "default" : "outline"}
                onClick={() => setRemoteOnly((v) => !v)}
                className="h-11"
              >
                Remote only
              </Button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-border/70 bg-surface p-12 text-center">
              <p className="font-display text-lg font-semibold">No matching roles</p>
              <p className="mt-2 text-sm text-muted-foreground">Try different keywords or clear filters.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((job) => (
                <li key={job.id}>
                  <Link
                    to="/jobs/$id"
                    params={{ id: job.id }}
                    className="group flex flex-col gap-4 rounded-2xl border border-border/70 bg-surface p-6 transition-all hover:border-primary/40 hover:shadow-md sm:flex-row sm:items-center"
                  >
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                      <Briefcase className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-lg font-semibold group-hover:text-primary">{job.title}</span>
                        {job.remote && <Badge variant="secondary" className="rounded-full">Remote</Badge>}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{job.company}</span> · {job.location} · {job.employment_type}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(job.tags ?? []).slice(0, 4).map((t) => (
                          <span key={t} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">{t}</span>
                        ))}
                      </div>
                    </div>
                    {job.salary_min && job.salary_max && (
                      <div className="text-sm font-semibold sm:text-right">
                        ${job.salary_min.toLocaleString()} – ${job.salary_max.toLocaleString()}
                        <div className="text-xs font-normal text-muted-foreground">per year</div>
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
