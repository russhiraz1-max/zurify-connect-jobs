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
  id: string; status: string; created_at: string; note: string | null;
  user_id: string; rejection_reason: string | null;
  tasks: { title: string } | null;
  };

function AdminApplications() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState("pending");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function load() {
    const { data } = await supabase.from("task_applications")
      .select("id,status,created_at,note,user_id,rejection_reason,tasks(title)")
      .order("created_at", { ascending: false }).limit(500);
    setRows(((data ?? []) as unknown) as Row[]);
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
          ) : filtered.map(r => (
            <Card key={r.id}>
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.tasks?.title ?? "Task"}</p>
                  <p className="text-xs text-muted-foreground">{r.user_id.slice(0,8)} · {dateTime(r.created_at)}</p>
                  {r.note && <p className="mt-1 text-xs text-muted-foreground">Note: {r.note}</p>}
                  {r.rejection_reason && <p className="mt-1 text-xs text-destructive">Rejected: {r.rejection_reason}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge>
                  {r.status === "pending" && <>
                    <Button size="sm" onClick={() => approve(r.id)}>Approve</Button>
                    <Dialog open={rejectId === r.id} onOpenChange={o => { if (!o) { setRejectId(null); setReason(""); } }}>
                      <DialogTrigger asChild><Button size="sm" variant="outline" onClick={() => setRejectId(r.id)}>Reject</Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Reject application</DialogTitle></DialogHeader>
                        <Textarea placeholder="Reason…" value={reason} onChange={e => setReason(e.target.value)} />
                        <Button onClick={reject} disabled={!reason}>Confirm reject</Button>
                      </DialogContent>
                    </Dialog>
                  </>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
