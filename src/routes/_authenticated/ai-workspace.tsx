import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Loader2, Plus, RefreshCw, Sparkles } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/ai-workspace")({
  head: () => ({ meta: [{ title: "AI data workspace — Zurify" }] }),
  component: AiWorkspacePage,
});

type Organization = {
  id: string;
  legal_name: string;
  website: string | null;
  contact_email: string;
  verification_status: "pending" | "approved" | "rejected";
  verification_notes: string | null;
};

type AiProject = {
  id: string;
  title: string;
  project_type: string;
  language: string;
  dialect: string | null;
  locale: string | null;
  region: string | null;
  expected_records: number;
  status: string;
  review_notes: string | null;
  created_at: string;
};

const projectTypes = [
  { value: "data_collection", label: "Data collection" },
  { value: "transcription", label: "Transcription" },
  { value: "pronunciation", label: "Speech & pronunciation" },
  { value: "labeling", label: "Data labeling" },
  { value: "evaluation", label: "Model evaluation" },
  { value: "language_culture", label: "Language & cultural data" },
];

function AiWorkspacePage() {
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useSession();
  const { roles, loading: rolesLoading } = useRoles();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [projects, setProjects] = useState<AiProject[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [savingOrganization, setSavingOrganization] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [legalName, setLegalName] = useState("");
  const [website, setWebsite] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const [title, setTitle] = useState("");
  const [projectType, setProjectType] = useState("language_culture");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [language, setLanguage] = useState("Swahili");
  const [dialect, setDialect] = useState("");
  const [locale, setLocale] = useState("");
  const [region, setRegion] = useState("East Africa");
  const [expectedRecords, setExpectedRecords] = useState("100");

  useEffect(() => {
    if (sessionLoading || rolesLoading) return;
    if (!user) {
      void navigate({ to: "/auth", replace: true });
      return;
    }
    if (roles.includes("ai_company")) return;
    const destination = roles.some(role => ["super_admin", "staff"].includes(role))
      ? "/admin"
      : roles.includes("employer")
        ? "/client-dashboard"
        : roles.includes("job_seeker")
          ? "/dashboard"
          : "/choose-account-type";
    void navigate({ to: destination as never, replace: true });
  }, [user, sessionLoading, rolesLoading, roles, navigate]);

  async function loadWorkspace() {
    if (!user || !roles.includes("ai_company")) return;
    setLoadingData(true);
    try {
      const orgResult = await (supabase as unknown as { from: (table: string) => { select: (columns: string) => { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> } } })
        .from("ai_company_organizations").select("*").maybeSingle();
      if (orgResult.error) throw new Error(orgResult.error.message);
      const org = orgResult.data as Organization | null;
      setOrganization(org);
      if (org) {
        setLegalName(org.legal_name);
        setWebsite(org.website ?? "");
        setContactEmail(org.contact_email);
        const projectsResult = await (supabase as unknown as { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { order: (column: string, options: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: { message: string } | null }> } } } })
          .from("ai_data_projects").select("*").eq("organization_id", org.id).order("created_at", { ascending: false });
        if (projectsResult.error) throw new Error(projectsResult.error.message);
        setProjects((projectsResult.data ?? []) as AiProject[]);
      } else {
        setProjects([]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't load the AI workspace.");
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (!sessionLoading && !rolesLoading && user && roles.includes("ai_company")) void loadWorkspace();
  }, [sessionLoading, rolesLoading, user, roles]);

  async function saveOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingOrganization(true);
    const { error } = await supabase.rpc("create_ai_company_profile" as never, {
      _legal_name: legalName.trim(),
      _website: website.trim() || null,
      _contact_email: contactEmail.trim(),
    } as never);
    setSavingOrganization(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Organization details saved. Verification is pending.");
    await loadWorkspace();
  }

  async function createProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProject(true);
    const { error } = await supabase.rpc("create_ai_data_project" as never, {
      _title: title.trim(),
      _project_type: projectType,
      _description: description.trim(),
      _instructions: instructions.trim(),
      _language: language.trim(),
      _dialect: dialect.trim() || null,
      _locale: locale.trim() || null,
      _region: region.trim() || null,
      _expected_records: Number(expectedRecords),
      _consent_required: true,
    } as never);
    setSavingProject(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Project draft created. No contributors or funds have been assigned.");
    setTitle("");
    setDescription("");
    setInstructions("");
    await loadWorkspace();
  }

  async function submitProject(projectId: string) {
    setSubmittingId(projectId);
    const { error } = await supabase.rpc("submit_ai_project_for_review" as never, { _project_id: projectId } as never);
    setSubmittingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Project submitted for review.");
    await loadWorkspace();
  }

  if (sessionLoading || rolesLoading || !user || !roles.includes("ai_company")) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing your AI workspace…</div>;
  }

  return (
    <AppShell title="AI data workspace" subtitle="Create responsible language, speech, labeling and evaluation projects. Company verification and human review protect contributors and dataset quality.">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-sky-500/20 bg-gradient-to-br from-sky-500/10 via-card to-violet-500/5">
            <CardHeader className="pb-2"><CardDescription>Organization status</CardDescription><CardTitle className="text-xl">{organization?.verification_status ?? "Not submitted"}</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">{organization?.verification_status === "approved" ? "Your organization can submit eligible projects for review." : "Projects remain drafts until staff verifies your organization."}</CardContent>
          </Card>
          <Card><CardHeader className="pb-2"><CardDescription>Project drafts</CardDescription><CardTitle className="text-2xl">{projects.filter(project => project.status === "draft").length}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Drafts do not reserve budgets or publish work.</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Projects in review</CardDescription><CardTitle className="text-2xl">{projects.filter(project => project.status === "submitted").length}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Human review is required before a project can progress.</CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-sky-600" /> Organization profile</CardTitle>
            <CardDescription>Use accurate organization details. Verification notes will appear here if a reviewer needs more information.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveOrganization} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="ai-company-name">Legal or registered organization name</Label><Input id="ai-company-name" value={legalName} onChange={event => setLegalName(event.target.value)} minLength={2} maxLength={160} required /></div>
              <div className="space-y-1.5"><Label htmlFor="ai-company-email">Organization contact email</Label><Input id="ai-company-email" type="email" value={contactEmail} onChange={event => setContactEmail(event.target.value)} maxLength={254} required /></div>
              <div className="space-y-1.5 md:col-span-2"><Label htmlFor="ai-company-website">Website (optional)</Label><Input id="ai-company-website" type="url" placeholder="https://example.com" value={website} onChange={event => setWebsite(event.target.value)} maxLength={300} /></div>
              {organization?.verification_notes && <p className="text-sm text-amber-700 dark:text-amber-300 md:col-span-2">Reviewer note: {organization.verification_notes}</p>}
              <div className="md:col-span-2"><Button type="submit" disabled={savingOrganization}>{savingOrganization && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{organization ? "Update organization details" : "Submit organization for verification"}</Button></div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-violet-600" /> Create an AI data project</CardTitle>
            <CardDescription>Describe the work and metadata clearly. Contributor consent is required. Project drafts are not published, funded or assigned to workers.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createProject} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5 md:col-span-2"><Label htmlFor="ai-project-title">Project title</Label><Input id="ai-project-title" value={title} onChange={event => setTitle(event.target.value)} minLength={4} maxLength={160} required placeholder="e.g. Swahili conversational speech collection" /></div>
              <div className="space-y-1.5"><Label htmlFor="ai-project-type">Project type</Label><select id="ai-project-type" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={projectType} onChange={event => setProjectType(event.target.value)}>{projectTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></div>
              <div className="space-y-1.5"><Label htmlFor="ai-project-records">Expected records</Label><Input id="ai-project-records" type="number" min={1} max={1000000} value={expectedRecords} onChange={event => setExpectedRecords(event.target.value)} required /></div>
              <div className="space-y-1.5"><Label htmlFor="ai-project-language">Language</Label><Input id="ai-project-language" value={language} onChange={event => setLanguage(event.target.value)} maxLength={100} required /></div>
              <div className="space-y-1.5"><Label htmlFor="ai-project-dialect">Dialect / accent (optional)</Label><Input id="ai-project-dialect" value={dialect} onChange={event => setDialect(event.target.value)} maxLength={100} placeholder="e.g. Coastal Swahili" /></div>
              <div className="space-y-1.5"><Label htmlFor="ai-project-locale">Locale tag (optional)</Label><Input id="ai-project-locale" value={locale} onChange={event => setLocale(event.target.value)} maxLength={50} placeholder="e.g. sw-KE" /></div>
              <div className="space-y-1.5"><Label htmlFor="ai-project-region">Region (optional)</Label><Input id="ai-project-region" value={region} onChange={event => setRegion(event.target.value)} maxLength={100} placeholder="e.g. East Africa" /></div>
              <div className="space-y-1.5 md:col-span-2"><Label htmlFor="ai-project-description">Project description</Label><Textarea id="ai-project-description" value={description} onChange={event => setDescription(event.target.value)} minLength={20} maxLength={5000} rows={3} required placeholder="Explain the dataset goal, intended use and scope." /></div>
              <div className="space-y-1.5 md:col-span-2"><Label htmlFor="ai-project-instructions">Contributor instructions and consent requirements</Label><Textarea id="ai-project-instructions" value={instructions} onChange={event => setInstructions(event.target.value)} minLength={20} maxLength={10000} rows={4} required placeholder="Describe each task, quality expectations, privacy restrictions and what contributors consent to provide." /></div>
              <div className="md:col-span-2 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-sm text-muted-foreground">Consent is enforced server-side. Do not include sensitive personal data in project instructions. Dataset uploads, worker assignment, billing and export remain disabled until separately implemented and reviewed.</div>
              <div className="md:col-span-2"><Button type="submit" disabled={savingProject || !organization}>{savingProject && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<Plus className="mr-2 h-4 w-4" />Create draft project</Button>{!organization && <p className="mt-2 text-xs text-muted-foreground">Save your organization profile before creating a project.</p>}</div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div><CardTitle>Your projects</CardTitle><CardDescription>Only your organization can see its project records.</CardDescription></div>
            <Button variant="outline" size="sm" onClick={() => void loadWorkspace()} disabled={loadingData}><RefreshCw className={`mr-2 h-4 w-4 ${loadingData ? "animate-spin" : ""}`} />Refresh</Button>
          </CardHeader>
          <CardContent>
            {loadingData ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading projects…</div> :
              projects.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center"><p className="font-medium">No AI data projects yet</p><p className="mt-1 text-sm text-muted-foreground">Create your first draft above. It will not be published automatically.</p></div> :
                <div className="space-y-3">{projects.map(project => <div key={project.id} className="rounded-xl border border-border/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0"><h3 className="font-semibold">{project.title}</h3><p className="mt-1 text-sm text-muted-foreground">{projectTypes.find(type => type.value === project.project_type)?.label ?? project.project_type} · {project.language}{project.dialect ? ` · ${project.dialect}` : ""} · {project.expected_records.toLocaleString()} expected records</p></div>
                    <Badge variant={project.status === "approved" || project.status === "active" ? "default" : "secondary"}>{project.status}</Badge>
                  </div>
                  {project.review_notes && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Reviewer note: {project.review_notes}</p>}
                  {organization?.verification_status === "approved" && ["draft", "rejected"].includes(project.status) && <Button size="sm" className="mt-3" onClick={() => void submitProject(project.id)} disabled={submittingId === project.id}>{submittingId === project.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<CheckCircle2 className="mr-2 h-4 w-4" />Submit for review</Button>}
                </div>)}</div>
            }
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
