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
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/tasks/new")({
  head: () => ({ meta: [{ title: "New task — Admin" }] }),
  component: NewTask,
});

function NewTask() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    title: "", description: "", instructions: "", proof_requirements: "",
    category_id: "", reward_cents: 100, est_minutes: 5, max_per_user: 1, max_total: "",
    requires_application: true, allow_reapplication: false, featured: false, priority: 0, status: "draft" as const,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("task_categories").select("id,name").order("name").then(({ data }) => setCats((data ?? []) as never));
  }, []);

  async function save(publish: boolean) {
    if (!form.title || !form.description) return toast.error("Title and description required");
    setBusy(true);
    const { error, data } = await supabase.from("tasks").insert({
      title: form.title,
      description: form.description,
      instructions: form.instructions || null,
      proof_requirements: form.proof_requirements || null,
      category_id: form.category_id || null as never,
      reward_cents: form.reward_cents,
      est_minutes: form.est_minutes,
      max_per_user: form.max_per_user,
      max_total: form.max_total ? parseInt(form.max_total) : null,
      requires_application: form.requires_application,
      allow_reapplication: form.allow_reapplication,
      featured: form.featured,
      priority: form.priority,
      status: publish ? "published" : "draft",
      created_by: user?.id ?? null,
    }).select("id").single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(publish ? "Task published" : "Draft saved");
    navigate({ to: "/admin/tasks/$id", params: { id: data!.id } });
  }

  return (
    <AdminShell title="New task">
      <Card className="max-w-3xl">
        <CardContent className="space-y-4 p-6">
          <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label>Instructions (shown after approval)</Label><Textarea rows={4} value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} /></div>
          <div><Label>Proof requirements</Label><Textarea rows={2} value={form.proof_requirements} onChange={e => setForm({ ...form, proof_requirements: e.target.value })} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>{cats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Reward (cents)</Label><Input type="number" value={form.reward_cents} onChange={e => setForm({ ...form, reward_cents: parseInt(e.target.value || "0") })} /></div>
            <div><Label>Est. minutes</Label><Input type="number" value={form.est_minutes} onChange={e => setForm({ ...form, est_minutes: parseInt(e.target.value || "0") })} /></div>
            <div><Label>Priority</Label><Input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: parseInt(e.target.value || "0") })} /></div>
            <div><Label>Max submissions per user</Label><Input type="number" value={form.max_per_user} onChange={e => setForm({ ...form, max_per_user: parseInt(e.target.value || "1") })} /></div>
            <div><Label>Max total submissions (blank = unlimited)</Label><Input type="number" value={form.max_total} onChange={e => setForm({ ...form, max_total: e.target.value })} /></div>
          </div>
          <div className="flex items-center gap-3"><Switch checked={form.requires_application} onCheckedChange={v => setForm({ ...form, requires_application: v })} /> <Label>Requires application</Label></div>
          <div className="flex items-center gap-3"><Switch checked={form.allow_reapplication} onCheckedChange={v => setForm({ ...form, allow_reapplication: v })} /> <Label>Allow re-application after rejection</Label></div>
          <div className="flex items-center gap-3"><Switch checked={form.featured} onCheckedChange={v => setForm({ ...form, featured: v })} /> <Label>Featured</Label></div>
          <div className="flex gap-2 pt-2">
            <Button disabled={busy} onClick={() => save(false)} variant="outline">Save as draft</Button>
            <Button disabled={busy} onClick={() => save(true)}>Publish</Button>
          </div>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
