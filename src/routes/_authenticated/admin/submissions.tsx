import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { dateTime, usd } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/submissions")({
  head: () => ({ meta: [{ title: "Submissions — Admin" }] }),
  component: AdminSubmissions,
});

type Row = {
  id: string; status: string; created_at: string; user_id: string;
  proof_text: string | null; proof_url: string | null; attachments: { path: string; name: string }[] | null;
  tasks: { title: string; reward_cents: number } | null;
  rejection_reason: string | null;
};
type Profile = { id: string; full_name: string | null };

function AdminSubmissions() {
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [tab, setTab] = useState("pending");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [allowResubmit, setAllowResubmit] = useState(true);

  async function load() {
    const { data } = await supabase.from("task_submissions")
      .select("id,status,created_at,user_id,proof_text,proof_url,attachments,rejection_reason,tasks(title,reward_cents)")
      .order("created_at", { ascending: false }).limit(500);
    const list = ((data ?? []) as unknown) as Row[];
    setRows(list);
    const ids = Array.from(new Set(list.map(r => r.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p: Profile) => { map[p.id] = p; });
      setProfiles(map);
    }
  }
  useEffect(() => { load(); }, []);

  async function approve(id: string) {
    const { error } = await supabase.rpc("approve_submission", { _submission_id: id, _notes: "" });
    if (error) return toast.error(error.message);
    toast.success("Approved & credited");
    load();
  }
  async function reject() {
    if (!rejectId || !reason) return;
    const { error } = await supabase.rpc("reject_submission", { _submission_id: rejectId, _reason: reason, _allow_resubmit: allowResubmit });
    if (error) return toast.error(error.message);
    toast.success("Rejected");
    setRejectId(null); setReason("");
    load();
  }

  async function proofLink(path: string) {
    const { data, error } = await supabase.storage.from("submission-proofs").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? "Cannot open file");
    window.open(data.signedUrl, "_blank");
  }


  const filtered = rows.filter(r => tab === "all" || r.status === tab);

  return (
    <AdminShell title="Submissions" subtitle="Review proofs and pay out rewards.">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="resubmit">Resubmit</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {filtered.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nothing here.</CardContent></Card>
          ) : filtered.map(r => (
            <Card key={r.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{r.tasks?.title} <span className="ml-2 text-xs text-muted-foreground">{usd(r.tasks?.reward_cents ?? 0)}</span></p>
                    <p className="text-xs text-muted-foreground">{profiles[r.user_id]?.full_name ?? r.user_id.slice(0,8)} · {dateTime(r.created_at)}</p>
                  </div>
                  <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge>
                </div>
                {r.proof_text && <p className="whitespace-pre-line rounded-md bg-accent/50 p-3 text-sm">{r.proof_text}</p>}
                {r.proof_url && <a href={r.proof_url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">Open proof URL</a>}
                {r.attachments && r.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {r.attachments.map(a => (
                      <Button key={a.path} variant="outline" size="sm" onClick={() => proofLink(a.path)}>{a.name}</Button>
                    ))}
                  </div>
                )}
                {r.rejection_reason && <p className="text-xs text-destructive">Rejected: {r.rejection_reason}</p>}
                {(r.status === "pending" || r.status === "resubmit") && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approve(r.id)}>Approve & pay</Button>
                    <Dialog open={rejectId === r.id} onOpenChange={o => { if (!o) { setRejectId(null); setReason(""); } }}>
                      <DialogTrigger asChild><Button size="sm" variant="outline" onClick={() => setRejectId(r.id)}>Reject</Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Reject submission</DialogTitle></DialogHeader>
                        <Textarea placeholder="Reason…" value={reason} onChange={e => setReason(e.target.value)} />
                        <div className="flex items-center gap-2"><Switch checked={allowResubmit} onCheckedChange={setAllowResubmit} /> <Label>Allow user to resubmit</Label></div>
                        <Button onClick={reject} disabled={!reason}>Confirm</Button>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
