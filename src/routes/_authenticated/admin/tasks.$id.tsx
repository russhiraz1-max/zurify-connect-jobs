import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/tasks/$id")({
  head: () => ({ meta: [{ title: "Edit task — Admin" }] }),
  component: EditTask,
});

function EditTask() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    supabase.from("task_categories").select("id,name").order("name").then(({ data }) => setCats((data ?? []) as never));
    supabase.from("tasks").select("*").eq("id", id).maybeSingle().then(({ data }) => setForm(data ?? null));
  }, [id]);

  async function save() {
    if (!form) return;
    const f = form as Record<string, unknown>;
    const { error } = await supabase.from("tasks").update({
      title: String(f.title ?? ""), description: String(f.description ?? ""),
      instructions: (f.instructions as string) ?? null,
      proof_requirements: (f.proof_requirements as string) ?? null,
      category_id: (f.category_id as string) || null as never,
      reward_cents: Number(f.reward_cents ?? 0), est_minutes: Number(f.est_minutes ?? 0),
      max_per_user: Number(f.max_per_user ?? 1),
      max_total: (f.max_total as number) ?? null,
      requires_application: Boolean(f.requires_application), allow_reapplication: Boolean(f.allow_reapplication),
      featured: Boolean(f.featured), priority: Number(f.priority ?? 0),
      status: f.status as "draft" | "published" | "paused" | "archived",
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  }

  async function del() {
    if (!confirm("Delete this task permanently?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    navigate({ to: "/admin/tasks" });
  }

  if (!form) return <AdminShell title="Edit task"><Skeleton className="h-96 w-full" /></AdminShell>;
  const f = form as Record<string, string | number | boolean | null>;
  const set = (k: string, v: unknown) => setForm({ ...form, [k]: v });

  return (
    <AdminShell title="Edit task">
      <Card className="max-w-3xl">
        <CardContent className="space-y-4 p-6">
          <div><Label>Title</Label><Input value={String(f.title ?? "")} onChange={e => set("title", e.target.value)} /></div>
          <div><Label>Description</Label><Textarea rows={3} value={String(f.description ?? "")} onChange={e => set("description", e.target.value)} /></div>
          <div><Label>Instructions</Label><Textarea rows={4} value={String(f.instructions ?? "")} onChange={e => set("instructions", e.target.value)} /></div>
          <div><Label>Proof requirements</Label><Textarea rows={2} value={String(f.proof_requirements ?? "")} onChange={e => set("proof_requirements", e.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Category</Label>
              <Select value={String(f.category_id ?? "")} onValueChange={v => set("category_id", v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>{cats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={String(f.status ?? "draft")} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Reward (cents)</Label><Input type="number" value={Number(f.reward_cents ?? 0)} onChange={e => set("reward_cents", parseInt(e.target.value || "0"))} /></div>
            <div><Label>Est. minutes</Label><Input type="number" value={Number(f.est_minutes ?? 0)} onChange={e => set("est_minutes", parseInt(e.target.value || "0"))} /></div>
            <div><Label>Priority</Label><Input type="number" value={Number(f.priority ?? 0)} onChange={e => set("priority", parseInt(e.target.value || "0"))} /></div>
            <div><Label>Max per user</Label><Input type="number" value={Number(f.max_per_user ?? 1)} onChange={e => set("max_per_user", parseInt(e.target.value || "1"))} /></div>
          </div>
          <div className="flex items-center gap-3"><Switch checked={Boolean(f.requires_application)} onCheckedChange={v => set("requires_application", v)} /> <Label>Requires application</Label></div>
          <div className="flex items-center gap-3"><Switch checked={Boolean(f.allow_reapplication)} onCheckedChange={v => set("allow_reapplication", v)} /> <Label>Allow re-application</Label></div>
          <div className="flex items-center gap-3"><Switch checked={Boolean(f.featured)} onCheckedChange={v => set("featured", v)} /> <Label>Featured</Label></div>
          <div className="flex justify-between pt-2">
            <Button variant="destructive" onClick={del}>Delete</Button>
            <Button onClick={save}>Save changes</Button>
          </div>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
