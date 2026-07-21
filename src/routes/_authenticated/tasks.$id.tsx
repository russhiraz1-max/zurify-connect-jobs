import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Upload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { usd } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/tasks/$id")({
  head: () => ({ meta: [{ title: "Task — Zurify" }] }),
  component: TaskDetailPage,
});

type Task = {
  id: string; title: string; description: string; instructions: string | null;
  proof_requirements: string | null; reward_cents: number; est_minutes: number | null;
  requires_application: boolean; allow_reapplication: boolean; status: string;
  starts_at: string | null; ends_at: string | null;
};
type App = { id: string; status: "pending" | "approved" | "rejected" | "cancelled"; rejection_reason: string | null };
type Sub = { id: string; status: string; rejection_reason: string | null; created_at: string };

function TaskDetailPage() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [app, setApp] = useState<App | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [coverLetter, setCoverLetter] = useState("");
  const [experience, setExperience] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [proofText, setProofText] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    setLoading(true);
    const [tRes, aRes, sRes] = await Promise.all([
      supabase.from("tasks").select("*").eq("id", id).maybeSingle(),
      supabase.from("task_applications").select("id,status,rejection_reason").eq("task_id", id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("task_submissions").select("id,status,rejection_reason,created_at").eq("task_id", id).eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setTask(tRes.data as Task | null);
    setApp(aRes.data as App | null);
    setSubs((sRes.data ?? []) as Sub[]);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id, user?.id]);

  async function apply() {
    if (!user) return;
    if (!coverLetter.trim()) return toast.error("Please write a cover letter");
    setBusy(true);
    let cv_path: string | null = null;
    if (cvFile) {
      if (cvFile.type !== "application/pdf") { setBusy(false); return toast.error("CV must be a PDF"); }
      const path = `${user.id}/applications/${id}/${Date.now()}-${cvFile.name}`;
      const up = await supabase.storage.from("submission-proofs").upload(path, cvFile);
      if (up.error) { setBusy(false); return toast.error(up.error.message); }
      cv_path = path;
    }
    const { error } = await supabase.rpc("apply_to_task", {
      _task_id: id,
      _note: coverLetter,
      _cover_letter: coverLetter,
      _experience: experience || undefined,
      _cv_path: cv_path || undefined,
    });

    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Application submitted — pending review");
    setCoverLetter(""); setExperience(""); setCvFile(null);
    load();
  }


  async function submit() {
    if (!user) return;
    if (!proofText && !proofUrl && !file) return toast.error("Provide proof text, a link, or a file");
    setBusy(true);
    const attachments: { path: string; name: string }[] = [];
    if (file) {
      const path = `${user.id}/${id}/${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("submission-proofs").upload(path, file);
      if (up.error) { setBusy(false); return toast.error(up.error.message); }
      attachments.push({ path, name: file.name });
    }
    const { error } = await supabase.rpc("submit_task", {
      _task_id: id, _proof_text: proofText || '', _proof_url: proofUrl || '',
      _attachments: attachments,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Submission sent for review");
    setProofText(""); setProofUrl(""); setFile(null);
    load();
  }

  if (loading) return <AppShell><Skeleton className="h-64 w-full" /></AppShell>;
  if (!task) return <AppShell title="Task not found"><Button onClick={() => navigate({ to: "/tasks" })}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button></AppShell>;

  const approved = app?.status === "approved";
  const canApply = !app || app.status === "rejected" || app.status === "cancelled";

  return (
    <AppShell>
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/tasks" })} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> All tasks
      </Button>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="font-display text-2xl font-bold">{task.title}</h1>
                  {task.est_minutes && <p className="mt-1 text-sm text-muted-foreground">~{task.est_minutes} min</p>}
                </div>
                <Badge className="bg-brand-gradient text-primary-foreground text-base">{usd(task.reward_cents)}</Badge>
              </div>
              <p className="mt-4 whitespace-pre-line text-sm text-foreground/90">{task.description}</p>
            </CardContent>
          </Card>

          {approved && task.instructions && (
            <Card>
              <CardContent className="p-6">
                <h2 className="font-semibold">Instructions</h2>
                <p className="mt-2 whitespace-pre-line text-sm text-foreground/90">{task.instructions}</p>
              </CardContent>
            </Card>
          )}

          {task.proof_requirements && (
            <Card>
              <CardContent className="p-6">
                <h2 className="font-semibold">Proof requirements</h2>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{task.proof_requirements}</p>
              </CardContent>
            </Card>
          )}

          {approved && (
            <Card>
              <CardContent className="space-y-4 p-6">
                <h2 className="font-semibold">Submit proof</h2>
                <div>
                  <Label htmlFor="proof-text">Notes</Label>
                  <Textarea id="proof-text" value={proofText} onChange={e => setProofText(e.target.value)} placeholder="Describe how you completed the task…" />
                </div>
                <div>
                  <Label htmlFor="proof-url">Proof URL</Label>
                  <Input id="proof-url" value={proofUrl} onChange={e => setProofUrl(e.target.value)} placeholder="https://…" />
                </div>
                <div>
                  <Label htmlFor="proof-file">Screenshot or file</Label>
                  <Input id="proof-file" type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                </div>
                <Button onClick={submit} disabled={busy}>
                  <Upload className="mr-2 h-4 w-4" /> Submit for review
                </Button>
              </CardContent>
            </Card>
          )}

          {subs.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h2 className="font-semibold">Your submissions</h2>
                <div className="mt-3 space-y-2">
                  {subs.map(s => (
                    <div key={s.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                      <span>{new Date(s.created_at).toLocaleString()}</span>
                      <Badge variant={s.status === "approved" ? "default" : s.status === "rejected" ? "destructive" : "secondary"}>{s.status}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <h2 className="font-semibold">Application status</h2>
              {!app && <p className="mt-2 text-sm text-muted-foreground">You haven't applied yet.</p>}
              {app && (
                <div className="mt-3 space-y-2">
                  <Badge variant={app.status === "approved" ? "default" : app.status === "rejected" ? "destructive" : "secondary"}>{app.status}</Badge>
                  {app.rejection_reason && (
                    <Alert variant="destructive"><AlertDescription className="text-xs">{app.rejection_reason}</AlertDescription></Alert>
                  )}
                </div>
              )}
              {canApply && task.requires_application && (
                <div className="mt-4 space-y-3">
                  <div>
                    <Label htmlFor="app-cover">Cover letter <span className="text-destructive">*</span></Label>
                    <Textarea id="app-cover" value={coverLetter} onChange={e => setCoverLetter(e.target.value)} rows={4} placeholder="Explain why you're a good fit…" />
                  </div>
                  <div>
                    <Label htmlFor="app-exp">Relevant experience (optional)</Label>
                    <Textarea id="app-exp" value={experience} onChange={e => setExperience(e.target.value)} rows={3} />
                  </div>
                  <div>
                    <Label htmlFor="app-cv">CV / Resume — PDF (optional)</Label>
                    <Input id="app-cv" type="file" accept="application/pdf" onChange={e => setCvFile(e.target.files?.[0] ?? null)} />
                  </div>
                  <Button onClick={apply} disabled={busy || !coverLetter.trim()} className="w-full">Submit application</Button>
                </div>
              )}

              {!task.requires_application && !approved && (
                <p className="mt-3 text-xs text-muted-foreground">No application required — you can submit directly.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
