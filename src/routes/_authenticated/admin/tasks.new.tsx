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
import { TokenInput } from "@/components/token-input";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { DIFFICULTIES, EXPERIENCE_LEVELS, JOB_TYPES, type ExperienceLevel, type JobDifficulty, type JobType } from "@/lib/jobs";

export const Route = createFileRoute("/_authenticated/admin/tasks/new")({
  head: () => ({ meta: [{ title: "New job listing — Admin" }] }),
  component: NewJob,
});

function NewJob() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: "", description: "", instructions: "", proof_requirements: "",
    category_id: "", reward_cents: 100, est_minutes: 5, max_per_user: 1, max_total: "",
    requires_application: true, allow_reapplication: false, featured: false, priority: 0,
    job_type: "micro_task" as JobType, experience_level: "entry" as ExperienceLevel,
    difficulty: "easy" as JobDifficulty, is_remote: true, is_urgent: false, is_recommended: false,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("task_categories").select("id,name").eq("active", true).order("sort_order")
      .then(({ data }) => setCats((data ?? []) as never));
  }, []);

  async function save(publish: boolean) {
    if (!form.title || !form.description) return toast.error("Title and description are required");
    setBusy(true);
    const { error, data } = await supabase.from("tasks").insert({
      title: form.title,
      description: form.description,
      instructions: form.instructions || null as never,
      proof_requirements: form.proof_requirements || null as never,
      category_id: form.category_id || null as never,
      reward_cents: form.reward_cents,
      est_minutes: form.est_minutes,
      max_per_user: form.max_per_user,
      max_total: form.max_total ? parseInt(form.max_total) : null as never,
      requires_application: form.requires_application,
      allow_reapplication: form.allow_reapplication,
      featured: form.featured,
      priority: form.priority,
      job_type: form.job_type,
      experience_level: form.experience_level,
      difficulty: form.difficulty,
      is_remote: form.is_remote,
      is_urgent: form.is_urgent,
      is_recommended: form.is_recommended,
      skills,
      tags,
      status: publish ? "published" : "draft",
      created_by: user?.id ?? null,
    } as never).select("id").single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(publish ? "Job published" : "Draft saved");
    navigate({ to: "/admin/tasks/$id", params: { id: (data as { id: string }).id } });
  }

  return (
    <AdminShell title="New job listing" subtitle="Publish a micro task, gig, freelance project, remote role or contest.">
      <div className="max-w-3xl space-y-5">
        <Card>
          <CardContent className="space-y-4 p-5 sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Listing</h2>
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Instructions (shown after approval)</Label><Textarea rows={4} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
            <div><Label>Proof requirements</Label><Textarea rows={2} value={form.proof_requirements} onChange={(e) => setForm({ ...form, proof_requirements: e.target.value })} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5 sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Classification</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Job type</Label>
                <Select value={form.job_type} onValueChange={(v) => setForm({ ...form, job_type: v as JobType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {JOB_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">{JOB_TYPES.find((t) => t.value === form.job_type)?.blurb}</p>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Experience level</Label>
                <Select value={form.experience_level} onValueChange={(v) => setForm({ ...form, experience_level: v as ExperienceLevel })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EXPERIENCE_LEVELS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Difficulty</Label>
                <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v as JobDifficulty })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DIFFICULTIES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <TokenInput label="Required skills" placeholder="e.g. Copywriting" values={skills} onChange={setSkills} />
            <TokenInput label="Job tags" placeholder="e.g. quick-win" values={tags} onChange={setTags} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5 sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Reward &amp; limits</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Reward (cents)</Label><Input type="number" value={form.reward_cents} onChange={(e) => setForm({ ...form, reward_cents: parseInt(e.target.value || "0") })} /></div>
              <div><Label>Estimated completion (minutes)</Label><Input type="number" value={form.est_minutes} onChange={(e) => setForm({ ...form, est_minutes: parseInt(e.target.value || "0") })} /></div>
              <div><Label>Priority</Label><Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value || "0") })} /></div>
              <div><Label>Max submissions per user</Label><Input type="number" value={form.max_per_user} onChange={(e) => setForm({ ...form, max_per_user: parseInt(e.target.value || "1") })} /></div>
              <div className="sm:col-span-2"><Label>Max total submissions (blank = unlimited)</Label><Input type="number" value={form.max_total} onChange={(e) => setForm({ ...form, max_total: e.target.value })} /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5 sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Visibility &amp; workflow</h2>
            {([
              ["requires_application", "Requires application"],
              ["allow_reapplication", "Allow re-application after rejection"],
              ["featured", "Featured job"],
              ["is_recommended", "Recommended badge"],
              ["is_urgent", "Urgent hiring badge"],
              ["is_remote", "Remote / online"],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                <Label className="font-normal">{label}</Label>
                <Switch checked={Boolean(form[key])} onCheckedChange={(v) => setForm({ ...form, [key]: v })} />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2 pb-4">
          <Button disabled={busy} onClick={() => save(false)} variant="outline">Save as draft</Button>
          <Button disabled={busy} onClick={() => save(true)}>Publish job</Button>
        </div>
      </div>
    </AdminShell>
  );
}
