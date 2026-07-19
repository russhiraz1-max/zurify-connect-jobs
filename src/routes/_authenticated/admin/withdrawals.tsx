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
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { usd, dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/withdrawals")({
  head: () => ({ meta: [{ title: "Withdrawals — Admin" }] }),
  component: AdminWithdrawals,
});

type Row = {
  id: string; status: string; amount_cents: number; fee_cents: number; net_cents: number;
  destination: { paypal_email?: string }; created_at: string; rejection_reason: string | null;
  profiles: { full_name: string | null } | null; user_id: string;
};

function AdminWithdrawals() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState("pending");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function load() {
    const { data } = await supabase.from("withdrawal_requests")
      .select("id,status,amount_cents,fee_cents,net_cents,destination,created_at,rejection_reason,user_id,profiles!withdrawal_requests_user_id_fkey(full_name)")
      .order("created_at", { ascending: false }).limit(500);
    setRows((data ?? []) as Row[]);
  }
  useEffect(() => { load(); }, []);

  async function approve(id: string) {
    if (!confirm("Approve this withdrawal? User's balance will be deducted.")) return;
    const { error } = await supabase.rpc("approve_withdrawal", { _id: id, _notes: "" });
    if (error) return toast.error(error.message);
    toast.success("Approved");
    load();
  }
  async function reject() {
    if (!rejectId || !reason) return;
    const { error } = await supabase.rpc("reject_withdrawal", { _id: rejectId, _reason: reason });
    if (error) return toast.error(error.message);
    toast.success("Rejected");
    setRejectId(null); setReason("");
    load();
  }

  const filtered = rows.filter(r => tab === "all" || r.status === tab);

  return (
    <AdminShell title="Withdrawals" subtitle="Approve payouts and mark as paid.">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>User</TableHead><TableHead>PayPal</TableHead><TableHead>Requested</TableHead><TableHead>Net</TableHead><TableHead>Status</TableHead><TableHead>When</TableHead><TableHead></TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="p-8 text-center text-sm text-muted-foreground">Nothing here.</TableCell></TableRow>
                  ) : filtered.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{r.profiles?.full_name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{r.destination?.paypal_email ?? "—"}</TableCell>
                      <TableCell>{usd(r.amount_cents)}</TableCell>
                      <TableCell className="font-medium">{usd(r.net_cents)}</TableCell>
                      <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{dateTime(r.created_at)}</TableCell>
                      <TableCell>
                        {r.status === "pending" && (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => approve(r.id)}>Approve</Button>
                            <Dialog open={rejectId === r.id} onOpenChange={o => { if (!o) { setRejectId(null); setReason(""); } }}>
                              <DialogTrigger asChild><Button size="sm" variant="outline" onClick={() => setRejectId(r.id)}>Reject</Button></DialogTrigger>
                              <DialogContent>
                                <DialogHeader><DialogTitle>Reject withdrawal</DialogTitle></DialogHeader>
                                <Textarea placeholder="Reason…" value={reason} onChange={e => setReason(e.target.value)} />
                                <Button onClick={reject} disabled={!reason}>Confirm</Button>
                              </DialogContent>
                            </Dialog>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
