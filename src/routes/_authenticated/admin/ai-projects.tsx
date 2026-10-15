import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Database, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/ai-projects")({
  head: () => ({ meta: [{ title: "AI project review — Admin" }] }),
  component: AiProjectReviewPage,
});

type AiProject = {
  id: string;
  organization_id: string;
  title: string;
  project_type: string;
  description: string;
  instructions: string;
  language: string;
  dialect: string | null;
  locale: string | null;
  region: string | null;
  expected_records: number;
  consent_required: boolean;
  status: string;
  review_notes: string | null;
  created_at: string;
};

function AiProjectReviewPage() {
  const [projects, setProjects] = useState<AiProject[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await (supabase as unknown as { from: (table: string) => { select: (columns: string) => { order: (column: string, options: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: { message: string } | null }> } } })
      .from("ai_data_projects").select("*").order("created_at", { ascending: false });
    if (result.error) toast.error(result.error.message);
    else setProjects((result.data ?? []) as AiProject[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function review(id: string, decision: "approved" | "rejected") {
    setBusyId(id);
    const { error } = await supabase.rpc("review_ai_data_project" as never, {
      _project_id: id,
      _decision: decision,
      _notes: notes[id]?.trim() || null,
    } as never);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(decision === "approved" ? "Project approved for the next workflow milestone." : "Project returned for changes.");
    await load();
  }

  return (
    <AdminShell title="AI project review" subtitle="Check task instructions, locale metadata, consent, expected volume and data-use boundaries before approving a project. Approval does not publish work or authorize payment.">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{projects.filter(project => project.status === "submitted").length} submitted for review</p>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
      </div>
      {loading ? <Card><CardContent className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading projects…</CardContent></Card> :
        projects.length === 0 ? <Card><CardContent className="p-8 text-center"><Database className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">No AI data projects yet</p><p className="mt-1 text-sm text-muted-foreground">Submitted projects will appear here for review.</p></CardContent></Card> :
          <div className="space-y-4">{projects.map(project => <Card key={project.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><CardTitle>{project.title}</CardTitle><CardDescription className="mt-1">{project.project_type.replaceAll("_", " ")} · {project.language}{project.dialect ? ` · ${project.dialect}` : ""} · {project.expected_records.toLocaleString()} expected records</CardDescription></div>
                <Badge variant={project.status === "approved" || project.status === "active" ? "default" : "secondary"}>{project.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed">{project.description}</p>
              <div className="rounded-xl border bg-muted/30 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contributor instructions</p><p className="mt-2 whitespace-pre-wrap text-sm">{project.instructions}</p></div>
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <p><span className="text-muted-foreground">Locale:</span> {project.locale || "Not specified"}</p>
                <p><span className="text-muted-foreground">Region:</span> {project.region || "Not specified"}</p>
                <p><span className="text-muted-foreground">Consent required:</span> {project.consent_required ? "Yes" : "No"}</p>
              </div>
              {project.review_notes && <p className="rounded-lg bg-muted p-3 text-sm">Previous reviewer note: {project.review_notes}</p>}
              <p className="text-xs text-muted-foreground">Submitted {new Date(project.created_at).toLocaleString()} · Organization ID {project.organization_id}</p>
              {project.status === "submitted" && <>
                <Textarea value={notes[project.id] ?? ""} onChange={event => setNotes(prev => ({ ...prev, [project.id]: event.target.value }))} maxLength={2000} rows={2} placeholder="Review note or required changes." />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void review(project.id, "approved")} disabled={busyId === project.id}><CheckCircle2 className="mr-2 h-4 w-4" />Approve project</Button>
                  <Button variant="destructive" onClick={() => void review(project.id, "rejected")} disabled={busyId === project.id}><XCircle className="mr-2 h-4 w-4" />Return for changes</Button>
                </div>
              </>}
            </CardContent>
          </Card>)}</div>}
    </AdminShell>
  );
}
