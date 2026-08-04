import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  head: () => ({ meta: [{ title: "Categories — Admin" }] }),
  component: AdminCategories,
});

type Cat = {
  id: string; name: string; slug: string; icon: string | null;
  description: string | null; color: string; active: boolean; sort_order: number;
};

const COLORS = ["blue", "sky", "cyan", "teal", "emerald", "green", "lime", "amber", "orange", "red", "rose", "pink", "fuchsia", "violet", "indigo", "slate", "gray"];

export function categoryTint(color: string) {
  const map: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    green: "bg-green-500/10 text-green-600 dark:text-green-400",
    lime: "bg-lime-500/10 text-lime-600 dark:text-lime-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    red: "bg-red-500/10 text-red-600 dark:text-red-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    pink: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    fuchsia: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    slate: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  };
  return map[color] ?? "bg-muted text-muted-foreground";
}

function AdminCategories() {
  const [rows, setRows] = useState<Cat[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [form, setForm] = useState({ name: "", slug: "", icon: "", description: "", color: "blue", sort_order: 50 });

  async function load() {
    const [{ data }, { data: jobs }] = await Promise.all([
      supabase.from("task_categories").select("*").order("sort_order").order("name"),
      supabase.from("tasks").select("category_id").eq("status", "published"),
    ]);
    setRows((data ?? []) as Cat[]);
    const c: Record<string, number> = {};
    ((jobs ?? []) as { category_id: string | null }[]).forEach((j) => {
      if (j.category_id) c[j.category_id] = (c[j.category_id] ?? 0) + 1;
    });
    setCounts(c);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.name || !form.slug) return toast.error("Name and slug are required");
    const { error } = await supabase.from("task_categories").insert({
      name: form.name, slug: form.slug, icon: form.icon || null,
      description: form.description || null, color: form.color, sort_order: form.sort_order,
    } as never);
    if (error) return toast.error(error.message);
    toast.success("Category added");
    setForm({ name: "", slug: "", icon: "", description: "", color: "blue", sort_order: 50 });
    load();
  }

  async function patch(id: string, values: Partial<Cat>) {
    const { error } = await supabase.from("task_categories").update(values as never).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  async function del(id: string) {
    if (!confirm("Delete this category? Jobs in it will become uncategorised.")) return;
    const { error } = await supabase.from("task_categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  return (
    <AdminShell title="Categories" subtitle="Marketplace categories shown across Browse jobs and the landing page.">
      <Card className="mb-6">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div>
            <Label>Slug</Label>
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} />
          </div>
          <div><Label>Icon (lucide name)</Label><Input placeholder="Palette" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label>Sort order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value || "50") })} /></div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Label>Colour theme</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                  className={`rounded-md px-3 py-1 text-xs capitalize ring-offset-background transition ${categoryTint(c)} ${form.color === c ? "ring-2 ring-primary ring-offset-2" : ""}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div><Button onClick={create}>Add category</Button></div>
        </CardContent>
      </Card>

      {rows === null ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Loading categories…</CardContent></Card>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No categories yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md px-2 py-0.5 text-xs capitalize ${categoryTint(r.color)}`}>{r.color}</span>
                    <p className="truncate font-medium">{r.name}</p>
                    <Badge variant="secondary">{counts[r.id] ?? 0} live</Badge>
                    {!r.active && <Badge variant="outline">Hidden</Badge>}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">/{r.slug}{r.icon ? ` · ${r.icon}` : ""}</p>
                  <Textarea
                    rows={2}
                    className="mt-2 text-sm"
                    defaultValue={r.description ?? ""}
                    placeholder="Short description shown to job seekers"
                    onBlur={(e) => e.target.value !== (r.description ?? "") && patch(r.id, { description: e.target.value || null })}
                  />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={r.active} onCheckedChange={(v) => patch(r.id, { active: v })} />
                    <span className="text-xs text-muted-foreground">Active</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => del(r.id)}>Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
