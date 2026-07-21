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
import { supabase } from "@/integrations/supabase/client";
import { dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/applications")({
  head: () => ({ meta: [{ title: "Applications — Admin" }] }),
  component: AdminApplications,
});

type Row = {
  id: string; status: string; created_at: string;
  note: string | null; cover_letter: string | null; experience: string | null; cv_path: string | null;
  user_id: string; rejection_reason: string | null;
  tasks: { title: string } | null;
};
type Profile = { id: string; full_name: string | null };

function AdminApplications() {
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [tab, setTab] = useState("pending");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function load() {
    const { data } = await supabase.from("task_applications")
      .select("id,status,created_at,note,cover_letter,experience,cv_path,user_id,rejection_reason,tasks(title)")
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
    const { error } = await supabase.rpc("approve_application", { _id: id, _notes: "" });
    if (error) return toast.error(error.message);
    toast.success("Approved");
    load();
  }
  async function reject() {
    if (!rejectId || !reason) return;
    const { error } = await supabase.rpc("reject_application", { _id: rejectId, _reason: reason });
    if (error) return toast.error(error.message);
    toast.success("Rejected");
    setRejectId(null); setReason("");
    load();
  }
  async function openCv(path: string) {
    const { data, error } = await supabase.storage.from("submission-proofs").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? "Cannot open CV");
    window.open(data.signedUrl, "_blank");
  }

  const filtered = rows.filter(r => tab === "all" || r.status === tab);

  return (
    <AdminShell title="Applications" subtitle="Approve or reject task applications.">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {filtered.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nothing here.</CardContent></Card>
          ) : filtered.map(r => {
            const p = profiles[r.user_id];
            const cover = r.cover_letter ?? r.note;
            return (
              <Card key={r.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">{r.tasks?.title ?? "Task"}</p>
                      <p className="text-xs text-muted-foreground">
                        Applicant: {p?.full_name ?? r.user_id.slice(0, 8)} · {dateTime(r.created_at)}
                      </p>
                    </div>
                    <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge>
                  </div>
                  {cover && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Cover letter</p>
                      <p className="whitespace-pre-line rounded-md bg-accent/40 p-3 text-sm">{cover}</p>
                    </div>
                  )}
                  {r.experience && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Experience</p>
                      <p className="whitespace-pre-line rounded-md bg-accent/30 p-3 text-sm">{r.experience}</p>
                    </div>
                  )}
                  {r.cv_path && (
                    <Button size="sm" variant="outline" onClick={() => openCv(r.cv_path!)}>View CV (PDF)</Button>
                  )}
                  {r.rejection_reason && <p className="text-xs text-destructive">Rejected: {r.rejection_reason}</p>}
                  {r.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => approve(r.id)}>Approve</Button>
                      <Dialog open={rejectId === r.id} onOpenChange={o => { if (!o) { setRejectId(null); setReason(""); } }}>
                        <DialogTrigger asChild><Button size="sm" variant="outline" onClick={() => setRejectId(r.id)}>Reject</Button></DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Reject application</DialogTitle></DialogHeader>
                          <Textarea placeholder="Reason…" value={reason} onChange={e => setReason(e.target.value)} />
                          <Button onClick={reject} disabled={!reason}>Confirm reject</Button>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
