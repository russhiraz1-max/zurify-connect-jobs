import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { usd } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Zurify" }] }),
  component: TasksPage,
});

type Task = { id: string; title: string; description: string; reward_cents: number; est_minutes: number | null; featured: boolean; category_id: string | null };
type Category = { id: string; name: string; slug: string };

function TasksPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");

  useEffect(() => {
    supabase.from("tasks").select("id,title,description,reward_cents,est_minutes,featured,category_id")
      .eq("status", "published").order("featured", { ascending: false }).order("priority", { ascending: false })
      .then(({ data }) => setTasks((data ?? []) as Task[]));
    supabase.from("task_categories").select("id,name,slug").order("name")
      .then(({ data }) => setCategories((data ?? []) as Category[]));
  }, []);

  const filtered = useMemo(() => {
    if (!tasks) return null;
    return tasks.filter(t =>
      (cat === "all" || t.category_id === cat) &&
      (q === "" || t.title.toLowerCase().includes(q.toLowerCase()) || t.description.toLowerCase().includes(q.toLowerCase()))
    );
  }, [tasks, q, cat]);

  return (
    <AppShell title="Browse tasks" subtitle="Apply to any task to get started.">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search tasks…" value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="sm:w-56"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered === null ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No tasks match your filters.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(t => (
            <Link key={t.id} to="/tasks/$id" params={{ id: t.id }} className="block">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold leading-tight">{t.title}</h3>
                    <Badge className="shrink-0 bg-brand-gradient text-primary-foreground">{usd(t.reward_cents)}</Badge>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{t.description}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    {t.est_minutes ? <span>~{t.est_minutes} min</span> : <span />}
                    {t.featured && <Badge variant="secondary">Featured</Badge>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
