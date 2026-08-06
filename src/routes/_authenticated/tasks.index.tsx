import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { JobCard } from "@/components/job-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { DIFFICULTIES, EXPERIENCE_LEVELS, JOB_SELECT, JOB_TYPES, readRecentJobs, type JobRow } from "@/lib/jobs";
import { isJobLockedForUser, useJobProgress } from "@/lib/user-jobs";


export const Route = createFileRoute("/_authenticated/tasks/")({
  head: () => ({
    meta: [
      { title: "Browse jobs — Zurify" },
      { name: "description", content: "Browse micro tasks, gigs, freelance projects and remote opportunities on Zurify." },
      { property: "og:title", content: "Browse jobs — Zurify" },
      { property: "og:description", content: "Find paid work that fits you: micro tasks, gigs, freelance projects and remote roles." },
    ],
  }),
  component: BrowseJobs,
});

type Category = { id: string; name: string; slug: string };
type Sort = "recommended" | "latest" | "highest" | "quickest" | "trending";
const PAGE_SIZE = 12;

function BrowseJobs() {
  const [allJobs, setAllJobs] = useState<JobRow[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const progress = useJobProgress();

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [type, setType] = useState("all");
  const [exp, setExp] = useState("all");
  const [diff, setDiff] = useState("all");
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [skill, setSkill] = useState("all");
  const [sort, setSort] = useState<Sort>("recommended");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(readRecentJobs());
    supabase
      .from("tasks")
      .select(JOB_SELECT)
      .eq("status", "published")
      .then(({ data }) => setAllJobs((data ?? []) as unknown as JobRow[]));
    supabase
      .from("task_categories")
      .select("id,name,slug")
      .order("sort_order")
      .then(({ data }) => setCategories((data ?? []) as Category[]));
  }, []);

  // Jobs the member already completed, or that were permanently closed to them,
  // never appear anywhere in the marketplace — they're archived under "My work".
  const jobs = useMemo(() => {
    if (!allJobs || progress.loading) return allJobs && progress.loading ? null : allJobs;
    return allJobs.filter((j) => !isJobLockedForUser(j.id, progress));
  }, [allJobs, progress]);

  const inProgress = useMemo(() => {
    if (!jobs) return [];
    return jobs.filter(
      (j) =>
        progress.awaitingReview.has(j.id) ||
        progress.needsResubmit.has(j.id) ||
        progress.approved.has(j.id) ||
        progress.applied.has(j.id),
    );
  }, [jobs, progress]);

  const hiddenCount = (allJobs?.length ?? 0) - (jobs?.length ?? 0);

  const allSkills = useMemo(() => {
    const s = new Set<string>();
    (jobs ?? []).forEach((j) => (j.skills ?? []).forEach((x) => s.add(x)));
    return [...s].sort();
  }, [jobs]);


  const filtered = useMemo(() => {
    if (!jobs) return null;
    const min = minBudget ? Number(minBudget) * 100 : null;
    const max = maxBudget ? Number(maxBudget) * 100 : null;
    const term = q.trim().toLowerCase();
    const rows = jobs.filter(
      (j) =>
        (cat === "all" || j.category_id === cat) &&
        (type === "all" || j.job_type === type) &&
        (exp === "all" || j.experience_level === exp) &&
        (diff === "all" || j.difficulty === diff) &&
        (skill === "all" || (j.skills ?? []).includes(skill)) &&
        (min === null || j.reward_cents >= min) &&
        (max === null || j.reward_cents <= max) &&
        (term === "" ||
          j.title.toLowerCase().includes(term) ||
          j.description.toLowerCase().includes(term) ||
          (j.skills ?? []).some((s) => s.toLowerCase().includes(term)) ||
          (j.tags ?? []).some((s) => s.toLowerCase().includes(term))),
    );
    const byDate = (a: JobRow, b: JobRow) => +new Date(b.created_at) - +new Date(a.created_at);
    switch (sort) {
      case "latest":
        return [...rows].sort(byDate);
      case "highest":
        return [...rows].sort((a, b) => b.reward_cents - a.reward_cents);
      case "quickest":
        return [...rows].sort((a, b) => (a.est_minutes ?? 9999) - (b.est_minutes ?? 9999));
      case "trending":
        return [...rows].sort((a, b) => Number(b.is_urgent) - Number(a.is_urgent) || b.priority - a.priority || byDate(a, b));
      default:
        return [...rows].sort(
          (a, b) =>
            Number(b.is_recommended) - Number(a.is_recommended) ||
            Number(b.featured) - Number(a.featured) ||
            b.priority - a.priority ||
            byDate(a, b),
        );
    }
  }, [jobs, q, cat, type, exp, diff, skill, minBudget, maxBudget, sort]);

  useEffect(() => setPage(1), [q, cat, type, exp, diff, skill, minBudget, maxBudget, sort]);

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name;
  const totalPages = filtered ? Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)) : 1;
  const pageRows = filtered ? filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : null;
  const recentJobs = (jobs ?? []).filter((j) => recent.includes(j.id)).slice(0, 3);

  const activeFilters =
    (cat !== "all" ? 1 : 0) + (type !== "all" ? 1 : 0) + (exp !== "all" ? 1 : 0) + (diff !== "all" ? 1 : 0) +
    (skill !== "all" ? 1 : 0) + (minBudget ? 1 : 0) + (maxBudget ? 1 : 0);

  function reset() {
    setCat("all"); setType("all"); setExp("all"); setDiff("all"); setSkill("all");
    setMinBudget(""); setMaxBudget("");
  }

  return (
    <AppShell title="Browse jobs" subtitle="Micro tasks, gigs, freelance projects and remote opportunities.">
      {/* Search + sort */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search jobs, skills or tags…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex">
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recommended">Recommended</SelectItem>
              <SelectItem value="latest">Latest</SelectItem>
              <SelectItem value="trending">Trending</SelectItem>
              <SelectItem value="highest">Highest paying</SelectItem>
              <SelectItem value="quickest">Quickest</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="shrink-0" onClick={() => setShowFilters((s) => !s)}>
            <SlidersHorizontal className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilters > 0 && <Badge variant="secondary" className="ml-2">{activeFilters}</Badge>}
          </Button>
        </div>
      </div>

      {/* Category chips */}
      <div className="mb-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <Button size="sm" variant={cat === "all" ? "default" : "outline"} className="shrink-0" onClick={() => setCat("all")}>
          All categories
        </Button>
        {categories.map((c) => (
          <Button key={c.id} size="sm" variant={cat === c.id ? "default" : "outline"} className="shrink-0" onClick={() => setCat(c.id)}>
            {c.name}
          </Button>
        ))}
      </div>

      {showFilters && (
        <Card className="mb-5">
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>Job type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {JOB_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Experience</Label>
              <Select value={exp} onValueChange={setExp}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any experience</SelectItem>
                  {EXPERIENCE_LEVELS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Difficulty</Label>
              <Select value={diff} onValueChange={setDiff}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any difficulty</SelectItem>
                  {DIFFICULTIES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Skill</Label>
              <Select value={skill} onValueChange={setSkill}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any skill</SelectItem>
                  {allSkills.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Min budget ($)</Label>
              <Input type="number" min="0" value={minBudget} onChange={(e) => setMinBudget(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Max budget ($)</Label>
              <Input type="number" min="0" value={maxBudget} onChange={(e) => setMaxBudget(e.target.value)} placeholder="Any" />
            </div>
            {activeFilters > 0 && (
              <div className="sm:col-span-2 lg:col-span-3">
                <Button variant="ghost" size="sm" onClick={reset}><X className="mr-1 h-4 w-4" /> Clear filters</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {inProgress.length > 0 && q === "" && activeFilters === 0 && (
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">Jobs you're working on</h2>
            <Badge variant="secondary">{inProgress.length}</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {inProgress.slice(0, 3).map((j) => (
              <JobCard key={j.id} job={j} categoryName={catName(j.category_id)} />
            ))}
          </div>
        </section>
      )}


      {recentJobs.length > 0 && q === "" && activeFilters === 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Recently viewed</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentJobs.map((j) => <JobCard key={j.id} job={j} categoryName={catName(j.category_id)} />)}
          </div>
        </section>
      )}

      {pageRows === null ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-52 rounded-lg" />)}
        </div>
      ) : pageRows.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="font-medium">No jobs match your filters</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different search term or clear your filters.</p>
            {(activeFilters > 0 || q !== "") && (
              <Button className="mt-4" variant="outline" onClick={() => { reset(); setQ(""); }}>Clear everything</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {filtered!.length} {filtered!.length === 1 ? "job" : "jobs"} available
            {hiddenCount > 0 && ` · ${hiddenCount} finished ${hiddenCount === 1 ? "job" : "jobs"} hidden`}

          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pageRows.map((j) => <JobCard key={j.id} job={j} categoryName={catName(j.category_id)} />)}
          </div>
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
