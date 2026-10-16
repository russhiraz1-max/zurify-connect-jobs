import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Building2, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/ai-companies")({
  head: () => ({ meta: [{ title: "AI company verification — Admin" }] }),
  component: AiCompanyReviewPage,
});

type AiOrganization = {
  id: string;
  legal_name: string;
  website: string | null;
  contact_email: string;
  verification_status: "pending" | "approved" | "rejected";
  verification_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
};

function AiCompanyReviewPage() {
  const [organizations, setOrganizations] = useState<AiOrganization[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await (supabase as unknown as { from: (table: string) => { select: (columns: string) => { order: (column: string, options: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: { message: string } | null }> } } })
      .from("ai_company_organizations").select("*").order("created_at", { ascending: false });
    if (result.error) toast.error(result.error.message);
    else setOrganizations((result.data ?? []) as AiOrganization[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function review(id: string, decision: "approved" | "rejected") {
    setBusyId(id);
    const { error } = await supabase.rpc("review_ai_company" as never, {
      _organization_id: id,
      _decision: decision,
      _notes: notes[id]?.trim() || null,
    } as never);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(decision === "approved" ? "Organization verified." : "Organization marked for follow-up.");
    await load();
  }

  return (
    <AdminShell title="AI company verification" subtitle="Review organization identity before allowing AI data projects to be submitted. All decisions are recorded in the audit log.">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{organizations.filter(org => org.verification_status === "pending").length} pending verification</p>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
      </div>
      {loading ? <Card><CardContent className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading organizations…</CardContent></Card> :
        organizations.length === 0 ? <Card><CardContent className="p-8 text-center"><Building2 className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">No AI company profiles yet</p><p className="mt-1 text-sm text-muted-foreground">New AI-company registrations will appear here.</p></CardContent></Card> :
          <div className="space-y-4">{organizations.map(org => <Card key={org.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><CardTitle>{org.legal_name}</CardTitle><CardDescription className="mt-1">{org.contact_email}{org.website ? ` · ${org.website}` : ""}</CardDescription></div>
                <Badge variant={org.verification_status === "approved" ? "default" : "secondary"}>{org.verification_status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {org.verification_notes && <p className="rounded-lg bg-muted p-3 text-sm">Previous reviewer note: {org.verification_notes}</p>}
              <p className="text-xs text-muted-foreground">Submitted {new Date(org.created_at).toLocaleString()}{org.reviewed_at ? ` · Reviewed ${new Date(org.reviewed_at).toLocaleString()}` : ""}</p>
              <Textarea value={notes[org.id] ?? ""} onChange={event => setNotes(prev => ({ ...prev, [org.id]: event.target.value }))} maxLength={2000} rows={2} placeholder="Review note or missing evidence (shown to the organization)." />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void review(org.id, "approved")} disabled={busyId === org.id}><CheckCircle2 className="mr-2 h-4 w-4" />Verify organization</Button>
                <Button variant="destructive" onClick={() => void review(org.id, "rejected")} disabled={busyId === org.id}><XCircle className="mr-2 h-4 w-4" />Request changes / reject</Button>
              </div>
            </CardContent>
          </Card>)}</div>}
    </AdminShell>
  );
}
