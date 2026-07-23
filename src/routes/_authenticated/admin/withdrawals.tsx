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
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { usd, dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/withdrawals")({
  head: () => ({ meta: [{ title: "Withdrawals — Admin" }] }),
  component: AdminWithdrawals,
});

type Row = {
  id: string; status: string; amount_cents: number; fee_cents: number; net_cents: number;
  destination: { paypal_email?: string } | null; created_at: string; rejection_reason: string | null;
  user_id: string;
  profiles: { full_name: string | null; avatar_url: string | null; withdrawal_hold: boolean } | null;
};

type WalletMap = Record<string, { available_cents: number; pending_withdrawal_cents: number; email: string | null }>;

function AdminWithdrawals() {
  const [rows, setRows] = useState<Row[]>([]);
  const [walletMap, setWalletMap] = useState<WalletMap>({});
  const [tab, setTab] = useState("pending");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [suspend, setSuspend] = useState(false);

  async function load() {
    const { data, error } = await supabase.from("withdrawal_requests")
      .select("id,status,amount_cents,fee_cents,net_cents,destination,created_at,rejection_reason,user_id,profiles!withdrawal_requests_user_id_profiles_fkey(full_name,avatar_url,withdrawal_hold)")
      .order("created_at", { ascending: false }).limit(500);
    if (error) toast.error(error.message);
    const list = ((data ?? []) as unknown) as Row[];
    setRows(list);
    // Fetch wallet info & email via admin_list_users (super only). Non-super will just see basic.
    const { data: users } = await supabase.rpc("admin_list_users");
    if (users) {
      const map: WalletMap = {};
      for (const u of users as { id: string; email: string | null; available_cents: number; pending_withdrawal_cents: number }[]) {
        map[u.id] = { available_cents: u.available_cents, pending_withdrawal_cents: u.pending_withdrawal_cents, email: u.email };
      }
      setWalletMap(map);
    }
  }
  useEffect(() => { load(); }, []);

  async function approve(id: string) {
    if (!confirm("Approve this withdrawal? Reserved balance will be released as withdrawn.")) return;
    const { error } = await supabase.rpc("approve_withdrawal", { _id: id, _notes: "" });
    if (error) return toast.error(error.message);
    toast.success("Approved");
    load();
  }
  async function reject() {
    if (!rejectId || !reason) return;
    const { error } = await supabase.rpc("reject_withdrawal", {
      _id: rejectId, _reason: reason, _suspend_withdrawals: suspend,
    });
    if (error) return toast.error(error.message);
    toast.success("Rejected");
    setRejectId(null); setReason(""); setSuspend(false);
    load();
  }

  const filtered = rows.filter(r => tab === "all" || r.status === tab);

  return (
    <AdminShell title="Withdrawals" subtitle="Approve payouts and mark them as paid within 48 hours.">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>PayPal</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="p-8 text-center text-sm text-muted-foreground">Nothing here.</TableCell></TableRow>
                  ) : filtered.map(r => {
                    const w = walletMap[r.user_id];
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <p className="font-medium">{r.profiles?.full_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{w?.email ?? "—"}</p>
                          {r.profiles?.withdrawal_hold && <Badge variant="destructive" className="mt-1">hold</Badge>}
                        </TableCell>
                        <TableCell className="text-sm">{r.destination?.paypal_email ?? "—"}</TableCell>
                        <TableCell>{usd(r.amount_cents)}</TableCell>
                        <TableCell className="text-muted-foreground">{usd(r.fee_cents)}</TableCell>
                        <TableCell className="font-medium">{usd(r.net_cents)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {w ? <>Avail {usd(w.available_cents)}<br />Pend {usd(w.pending_withdrawal_cents)}</> : "—"}
                        </TableCell>
                        <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{dateTime(r.created_at)}</TableCell>
                        <TableCell>
                          {r.status === "pending" && (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => approve(r.id)}>Approve</Button>
                              <Dialog open={rejectId === r.id} onOpenChange={o => { if (!o) { setRejectId(null); setReason(""); setSuspend(false); } }}>
                                <DialogTrigger asChild><Button size="sm" variant="outline" onClick={() => setRejectId(r.id)}>Reject</Button></DialogTrigger>
                                <DialogContent>
                                  <DialogHeader><DialogTitle>Reject withdrawal</DialogTitle></DialogHeader>
                                  <Textarea placeholder="Reason (shown to user)…" value={reason} onChange={e => setReason(e.target.value)} />
                                  <label className="flex items-center gap-2 text-sm">
                                    <Checkbox checked={suspend} onCheckedChange={v => setSuspend(!!v)} />
                                    Also suspend future withdrawals for this user
                                  </label>
                                  <Button onClick={reject} disabled={!reason}>Confirm reject</Button>
                                </DialogContent>
                              </Dialog>
                            </div>
                          )}
                          {r.status === "rejected" && r.rejection_reason && (
                            <p className="text-xs text-muted-foreground">{r.rejection_reason}</p>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
