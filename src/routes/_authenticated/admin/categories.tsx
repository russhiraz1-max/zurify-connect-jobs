import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  head: () => ({ meta: [{ title: "Categories — Admin" }] }),
  component: AdminCategories,
});

type Cat = { id: string; name: string; slug: string; icon: string | null };

function AdminCategories() {
  const [rows, setRows] = useState<Cat[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  async function load() {
    const { data } = await supabase.from("task_categories").select("*").order("name");
    setRows((data ?? []) as Cat[]);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!name || !slug) return;
    const { error } = await supabase.from("task_categories").insert({ name, slug });
    if (error) return toast.error(error.message);
    setName(""); setSlug("");
    load();
  }
  async function del(id: string) {
    if (!confirm("Delete category?")) return;
    const { error } = await supabase.from("task_categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <AdminShell title="Categories">
      <Card className="mb-4 max-w-lg">
        <CardContent className="space-y-3 p-4">
          <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Slug</Label><Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} /></div>
          <Button onClick={create}>Add category</Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {rows.map(r => (
              <li key={r.id} className="flex items-center justify-between p-3">
                <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.slug}</p></div>
                <Button size="sm" variant="ghost" onClick={() => del(r.id)}>Delete</Button>
              </li>
            ))}
            {rows.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No categories.</li>}
          </ul>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
