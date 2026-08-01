import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, Search } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/verification/")({
  head: () => ({ meta: [{ title: "Identity Verification — Admin" }] }),
  component: AdminKycList,
});

type Row = {
  id: string; user_id: string; full_name: string | null; email: string | null; phone: string;
  paypal_email: string; status: string; created_at: string; reviewed_at: string | null;
  withdrawal_hold: boolean; suspended: boolean; pending_withdrawals: number;
};

const tone = (s: string) => (s === "approved" ? "default" : s === "rejected" ? "destructive" : "secondary") as "default" | "destructive" | "secondary";

function AdminKycList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_kyc" as never);
    if (error) toast.error(error.message);
    setRows(((data ?? []) as unknown) as Row[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (r.full_name ?? "").toLowerCase().includes(s) || (r.email ?? "").toLowerCase().includes(s)
      || r.paypal_email.toLowerCase().includes(s) || r.phone.includes(q);
  });

  const counts = rows.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {} as Record<string, number>);

  return (
    <AdminShell title="Identity verification" subtitle="Review KYC submissions before first withdrawals are paid.">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Badge variant="secondary">Pending: {counts.pending ?? 0}</Badge>
        <Badge>Approved: {counts.approved ?? 0}</Badge>
        <Badge variant="destructive">Rejected: {counts.rejected ?? 0}</Badge>
        <div className="relative ml-auto w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search user, email, phone" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>User</TableHead><TableHead>Phone</TableHead><TableHead>PayPal</TableHead>
            <TableHead>Submitted</TableHead><TableHead>Status</TableHead><TableHead>Withdrawals</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="p-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="p-8 text-center text-sm text-muted-foreground">No verification submissions yet.</TableCell></TableRow>
            ) : filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="text-sm font-medium">{r.full_name ?? "Member"}</div>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </TableCell>
                <TableCell className="text-sm">{r.phone}</TableCell>
                <TableCell className="text-sm">{r.paypal_email}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{shortDate(r.created_at)}</TableCell>
                <TableCell><Badge variant={tone(r.status)}>{r.status}</Badge></TableCell>
                <TableCell className="text-sm">
                  {r.pending_withdrawals > 0 ? <Badge variant="secondary">{r.pending_withdrawals} pending</Badge> : <span className="text-muted-foreground">—</span>}
                  {r.withdrawal_hold && <Badge variant="destructive" className="ml-1">hold</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/admin/verification/$id" params={{ id: r.id }}><Eye className="mr-1.5 h-3.5 w-3.5" /> View verification</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </AdminShell>
  );
}
