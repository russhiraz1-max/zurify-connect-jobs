import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, Building2, DollarSign, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

const jobQuery = (id: string) => ({
  queryKey: ["job", id],
  queryFn: async () => {
    const { data, error } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) throw notFound();
    return data;
  },
});

export const Route = createFileRoute("/jobs/$id")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(jobQuery(params.id));
  },
  head: ({ loaderData: _ }) => ({
    meta: [
      { title: "Job details — Zurify" },
    ],
  }),
  component: JobDetailPage,
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-bold">Job not found</h1>
        <p className="mt-2 text-muted-foreground">This role may have been removed or filled.</p>
        <Button asChild className="mt-6"><Link to="/jobs">Browse open roles</Link></Button>
      </div>
      <SiteFooter />
    </div>
  ),
});

function JobDetailPage() {
  const { id } = Route.useParams();
  const { data: job } = useSuspenseQuery(jobQuery(id));
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [coverLetter, setCoverLetter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [applied, setApplied] = useState(false);

  async function apply() {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signup", redirect: `/jobs/${id}` } });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("applications").insert({
      job_id: id,
      applicant_id: user.id,
      cover_letter: coverLetter || null,
    });
    setSubmitting(false);
    if (error) {
      if (error.code === "23505") {
        setApplied(true);
        return toast.info("You've already applied to this role.");
      }
      return toast.error(error.message);
    }
    setApplied(true);
    qc.invalidateQueries({ queryKey: ["applications"] });
    toast.success("Application submitted!");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="border-b border-border/60 bg-surface-muted/50">
          <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
            <Link to="/jobs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> All jobs
            </Link>
            <div className="mt-6 flex flex-wrap items-start gap-5">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-primary-foreground shadow-sm">
                <Briefcase className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-3xl font-bold tracking-tight">{job.title}</h1>
                  {job.remote && <Badge variant="secondary" className="rounded-full">Remote</Badge>}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><Building2 className="h-4 w-4" /> {job.company}</span>
                  <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {job.location}</span>
                  <span className="inline-flex items-center gap-1.5"><Briefcase className="h-4 w-4" /> {job.employment_type}</span>
                  {job.salary_min && job.salary_max && (
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                      <DollarSign className="h-4 w-4" /> ${job.salary_min.toLocaleString()}–${job.salary_max.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-4xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_320px] lg:px-8">
          <article className="space-y-8">
            <section>
              <h2 className="font-display text-xl font-semibold">About the role</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{job.description}</p>
            </section>
            {job.requirements && (
              <section>
                <h2 className="font-display text-xl font-semibold">Requirements</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{job.requirements}</p>
              </section>
            )}
            {(job.tags ?? []).length > 0 && (
              <section>
                <h2 className="font-display text-xl font-semibold">Tags</h2>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(job.tags ?? []).map((t: string) => (
                    <span key={t} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">{t}</span>
                  ))}
                </div>
              </section>
            )}
          </article>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border/70 bg-surface p-6">
              <h3 className="font-display text-lg font-semibold">Apply now</h3>
              <p className="mt-1 text-sm text-muted-foreground">One-click apply with your Zurify profile.</p>
              {applied ? (
                <div className="mt-4 rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
                  Application submitted. Good luck!
                </div>
              ) : (
                <>
                  {user && (
                    <Textarea
                      placeholder="Add a short cover note (optional)"
                      value={coverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                      className="mt-4 min-h-[120px]"
                    />
                  )}
                  <Button onClick={apply} disabled={submitting} className="mt-4 h-11 w-full">
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {user ? "Submit application" : "Sign in to apply"}
                  </Button>
                </>
              )}
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
