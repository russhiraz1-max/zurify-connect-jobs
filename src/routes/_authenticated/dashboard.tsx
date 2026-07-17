import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Briefcase, ClipboardList, Search, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

const applicationsQuery = (userId: string) => ({
  queryKey: ["applications", userId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("applications")
      .select("id,status,created_at,cover_letter,job_id,jobs(id,title,company,location,employment_type)")
      .eq("applicant_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

const recommendedQuery = {
  queryKey: ["jobs", "recommended"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("jobs")
      .select("id,title,company,location,tags,remote")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw error;
    return data ?? [];
  },
};

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Zurify" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useSession();
  if (!user) return null;
  return <DashboardContent userId={user.id} name={user.user_metadata?.full_name ?? user.email ?? ""} />;
}

function DashboardContent({ userId, name }: { userId: string; name: string }) {
  const { data: apps } = useSuspenseQuery(applicationsQuery(userId));
  const { data: recs } = useSuspenseQuery(recommendedQuery);

  const stats = [
    { label: "Applications", value: apps.length, icon: ClipboardList },
    { label: "In review", value: apps.filter((a) => a.status === "submitted").length, icon: Sparkles },
    { label: "Saved searches", value: 0, icon: Search },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="border-b border-border/60 bg-surface-muted/50">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <h1 className="font-display text-3xl font-bold tracking-tight">Welcome back, {name.split(" ")[0]}</h1>
            <p className="mt-2 text-muted-foreground">Here's what's happening with your job search today.</p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-border/70 bg-surface p-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{s.label}</span>
                  <s.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-3 font-display text-3xl font-bold">{s.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold">Your applications</h2>
                <Button asChild variant="ghost" size="sm"><Link to="/jobs">Browse more</Link></Button>
              </div>
              {apps.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
                  <Briefcase className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 font-display text-lg font-semibold">No applications yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Start applying to open roles to see them here.</p>
                  <Button asChild className="mt-5"><Link to="/jobs">Find your first role</Link></Button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {apps.map((a) => {
                    const j = a.jobs as { id: string; title: string; company: string; location: string; employment_type: string } | null;
                    if (!j) return null;
                    return (
                      <li key={a.id}>
                        <Link
                          to="/jobs/$id"
                          params={{ id: j.id }}
                          className="flex items-center gap-4 rounded-2xl border border-border/70 bg-surface p-5 transition-colors hover:border-primary/40"
                        >
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                            <Briefcase className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-display font-semibold">{j.title}</div>
                            <div className="text-sm text-muted-foreground">{j.company} · {j.location}</div>
                          </div>
                          <div className="text-right">
                            <Badge variant="secondary" className="capitalize">{a.status}</Badge>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <aside>
              <h2 className="mb-4 font-display text-xl font-semibold">Recommended for you</h2>
              <ul className="space-y-3">
                {recs.map((j) => (
                  <li key={j.id}>
                    <Link
                      to="/jobs/$id"
                      params={{ id: j.id }}
                      className="block rounded-2xl border border-border/70 bg-surface p-5 transition-colors hover:border-primary/40"
                    >
                      <div className="text-xs font-medium text-muted-foreground">{j.company}</div>
                      <div className="mt-0.5 font-display font-semibold">{j.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{j.location}{j.remote ? " · Remote" : ""}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
