import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usd, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/tasks")({
  head: () => ({ meta: [{ title: "Admin tasks — Zurify" }] }),
  component: AdminTasks,
});

type Task = { id: string; title: string; status: string; reward_cents: number; featured: boolean; priority: number; created_at: string };

function AdminTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [q, setQ] = useState("");

  async function load() {
    const { data } = await supabase.from("tasks").select("id,title,status,reward_cents,featured,priority,created_at").order("created_at", { ascending: false });
    setTasks((data ?? []) as Task[]);
  }
  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: "draft" | "published" | "paused" | "archived") {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Task ${status}`);
    load();
  }

  async function duplicate(id: string) {
    const { data } = await supabase.from("tasks").select("*").eq("id", id).single();
    if (!data) return;
    const src = data as Record<string, unknown>;
    const insert: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src)) {
      if (k === "id" || k === "created_at" || k === "updated_at") continue;
      insert[k] = v;
    }
    insert.title = `${src.title as string} (copy)`;
    insert.status = "draft";
    const { error } = await supabase.from("tasks").insert(insert as never);
    if (error) return toast.error(error.message);
    toast.success("Duplicated");
    load();
  }

  async function del(id: string) {
    if (!confirm("Delete this task permanently?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  const filtered = tasks.filter(t => q === "" || t.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <AdminShell title="Tasks" subtitle="Create and manage all tasks.">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <Input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} className="sm:w-72" />
        <Button asChild><Link to="/admin/tasks/new"><Plus className="mr-1 h-4 w-4" /> New task</Link></Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Title</TableHead><TableHead>Status</TableHead><TableHead>Reward</TableHead><TableHead>Featured</TableHead><TableHead>Created</TableHead><TableHead className="w-12"></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="p-8 text-center text-sm text-muted-foreground">No tasks.</TableCell></TableRow>
              ) : filtered.map(t => (
                <TableRow key={t.id}>
                  <TableCell><Link to="/admin/tasks/$id" params={{ id: t.id }} className="font-medium hover:underline">{t.title}</Link></TableCell>
                  <TableCell><Badge variant={t.status === "published" ? "default" : "secondary"}>{t.status}</Badge></TableCell>
                  <TableCell>{usd(t.reward_cents)}</TableCell>
                  <TableCell>{t.featured ? "Yes" : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{shortDate(t.created_at)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setStatus(t.id, "published")}>Publish</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setStatus(t.id, "paused")}>Pause</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setStatus(t.id, "draft")}>Move to draft</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setStatus(t.id, "archived")}>Archive</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => duplicate(t.id)}>Duplicate</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onSelect={() => del(t.id)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
