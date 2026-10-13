import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Briefcase, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { useRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/client-dashboard")({
  head: () => ({ meta: [{ title: "Client workspace — Zurify" }] }),
  component: ClientDashboardPage,
});

type ClientTask = {
  id: string;
  title: string;
  status: string;
  reward_cents: number;
  created_at: string;
};

function ClientDashboardPage() {
  const { user, loading: sessionLoading } = useSession();
  const { roles, loading: rolesLoading } = useRoles();
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [reward, setReward] = useState("1.00");
  const [minutes, setMinutes] = useState("10");
  const [capacity, setCapacity] = useState("10");

  const canManage = roles.includes("employer") || roles.includes("staff") || roles.includes("super_admin") || roles.includes("admin");

  async function loadTasks() {
    if (!user) {
      setTasks([]);
      setLoadingTasks(false);
      return;
    }
    setLoadingTasks(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("id,title,status,reward_cents,created_at")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      toast.error("Couldn't load your task drafts: " + error.message);
    } else {
      setTasks((data ?? []) as ClientTask[]);
    }
    setLoadingTasks(false);
  }

  useEffect(() => {
    if (!sessionLoading && user && !rolesLoading) void loadTasks();
  }, [user, sessionLoading, rolesLoading]);

  async function createDraft(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const rewardCents = Math.round(Number(reward) * 100);
    const estimatedMinutes = Number(minutes);
    const maxTotal = Number(capacity);
    if (!Number.isFinite(rewardCents) || rewardCents < 1) {
      toast.error("Enter a valid reward amount.");
      return;
    }
    if (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 1) {
      toast.error("Enter an estimated time of at least one minute.");
      return;
    }
    if (!Number.isInteger(maxTotal) || maxTotal < 1) {
      toast.error("Enter a valid task capacity.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc("create_client_task" as never, {
      _title: title,
      _description: description,
      _instructions: instructions,
      _reward_cents: rewardCents,
      _category_id: null,
      _est_minutes: estimatedMinutes,
      _max_total: maxTotal,
    } as never);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Draft saved. It is not published and cannot receive submissions yet.");
    setTitle("");
    setDescription("");
    setInstructions("");
    await loadTasks();
  }

  if (sessionLoading || rolesLoading) {
    return <AppShell title="Client workspace" subtitle="Loading your account…"><div className="py-12 text-sm text-muted-foreground">Loading account permissions…</div></AppShell>;
  }

  if (!canManage) {
    return (
      <AppShell title="Client workspace" subtitle="A separate workspace for people hiring on Zurify">
        <Card>
          <CardHeader>
            <CardTitle>Client access required</CardTitle>
            <CardDescription>This area is for accounts registered to hire talent.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">If you meant to create a client account, sign up with “Hire talent”. Existing accounts will need a verified role change before they can use client tools.</p>
            <Button asChild><Link to="/dashboard">Return to your dashboard</Link></Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Client workspace" subtitle="Prepare work for review before it goes live">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              <CardTitle>Create a task draft</CardTitle>
            </div>
            <CardDescription>New tasks are saved as drafts. Publishing and payment authorization are intentionally not enabled yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createDraft} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="client-task-title">Task title</Label>
                <Input id="client-task-title" required minLength={4} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Review a mobile app onboarding flow" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-task-description">Description</Label>
                <Textarea id="client-task-description" required minLength={20} maxLength={3000} rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Explain the task and the expected result." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-task-instructions">Worker instructions</Label>
                <Textarea id="client-task-instructions" required minLength={10} maxLength={5000} rows={4} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Describe the steps and proof workers should submit." />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="client-task-reward">Reward (USD)</Label>
                  <Input id="client-task-reward" type="number" min="0.01" max="1000000" step="0.01" required value={reward} onChange={e => setReward(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client-task-minutes">Minutes</Label>
                  <Input id="client-task-minutes" type="number" min="1" max="1440" step="1" required value={minutes} onChange={e => setMinutes(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client-task-capacity">Worker slots</Label>
                  <Input id="client-task-capacity" type="number" min="1" max="100000" step="1" required value={capacity} onChange={e => setCapacity(e.target.value)} />
                </div>
              </div>
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" /> {saving ? "Saving draft…" : "Save draft"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Your task drafts</CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={() => void loadTasks()} disabled={loadingTasks}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loadingTasks ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
            <CardDescription>Only tasks created by your account are shown here.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTasks ? (
              <p className="text-sm text-muted-foreground">Loading tasks…</p>
            ) : tasks.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No task drafts yet. Create one to get started.</p>
            ) : (
              <div className="space-y-3">
                {tasks.map(task => (
                  <div key={task.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{task.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(task.created_at).toLocaleDateString()}</p>
                      </div>
                      <Badge variant={task.status === "published" ? "default" : "secondary"}>{task.status}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">Worker reward: $${(task.reward_cents / 100).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
