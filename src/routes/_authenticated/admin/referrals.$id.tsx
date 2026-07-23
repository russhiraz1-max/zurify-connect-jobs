import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { shortDate, usd, dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/referrals/$id")({
  head: () => ({ meta: [{ title: "Referral Details — Admin" }] }),
  component: RefDetails,
});

type Code = {
  id: string; code: string; owner_full_name: string | null; owner_email: string | null;
  status: string; max_uses: number | null; total_uses: number; created_at: string;
  users_referred: number; pending_bonus_users: number; awarded_bonus_users: number;
  total_bonus_cents: number; total_commission_cents: number;
};
type Ref = {
  referred_user_id: string; full_name: string | null; email: string | null;
  applied_at: string; bonus_awarded_at: string | null; bonus_amount_cents: number; total_commission_cents: number;
  wallet_available_cents: number; lifetime_withdrawn_cents: number; approved_tasks: number;
};

function RefDetails() {
  const { id } = Route.useParams();
  const [code, setCode] = useState<Code | null>(null);
  const [refs, setRefs] = useState<Ref[]>([]);

  useEffect(() => {
    (async () => {
      const [list, details] = await Promise.all([
        supabase.rpc("admin_list_referral_codes" as never),
        supabase.rpc("admin_referral_details" as never, { _id: id } as never),
      ]);
      const found = (((list.data ?? []) as unknown) as Code[]).find(c => c.id === id) ?? null;
      setCode(found);
      setRefs(((details.data ?? []) as unknown) as Ref[]);
    })();
  }, [id]);

  return (
    <AdminShell title="Referral details">
      <Button asChild variant="ghost" size="sm" className="mb-4"><Link to="/admin/referrals"><ArrowLeft className="mr-2 h-4 w-4" />Back to referrals</Link></Button>
      {code && (
        <Card className="mb-6">
          <CardContent className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs uppercase text-muted-foreground">Code</p><p className="mt-1 font-mono text-lg font-semibold">{code.code}</p></div>
            <div><p className="text-xs uppercase text-muted-foreground">Owner</p><p className="mt-1 text-sm font-medium">{code.owner_full_name ?? "—"}</p><p className="text-xs text-muted-foreground">{code.owner_email}</p></div>
            <div><p className="text-xs uppercase text-muted-foreground">Status</p><p className="mt-1"><Badge variant={code.status === "active" ? "default" : "secondary"}>{code.status}</Badge></p></div>
            <div><p className="text-xs uppercase text-muted-foreground">Created</p><p className="mt-1 text-sm">{dateTime(code.created_at)}</p></div>
            <div><p className="text-xs uppercase text-muted-foreground">Uses</p><p className="mt-1 text-sm font-semibold">{code.total_uses}{code.max_uses != null ? ` / ${code.max_uses}` : " (unlimited)"}</p></div>
            <div><p className="text-xs uppercase text-muted-foreground">Users referred</p><p className="mt-1 text-sm font-semibold">{code.users_referred}</p></div>
            <div><p className="text-xs uppercase text-muted-foreground">Total bonus paid</p><p className="mt-1 text-sm font-semibold">{usd(code.total_bonus_cents)}</p></div>
            <div><p className="text-xs uppercase text-muted-foreground">Total commission paid</p><p className="mt-1 text-sm font-semibold">{usd(code.total_commission_cents)}</p></div>
          </CardContent>
        </Card>
      )}
      <h2 className="mb-3 font-display text-lg font-semibold">Referred users</h2>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>User</TableHead><TableHead>Applied</TableHead><TableHead>Bonus</TableHead>
            <TableHead className="text-right">Approved tasks</TableHead><TableHead className="text-right">Wallet</TableHead>
            <TableHead className="text-right">Withdrawn</TableHead><TableHead className="text-right">Commission</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {refs.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="p-8 text-center text-sm text-muted-foreground">No users referred yet.</TableCell></TableRow>
            ) : refs.map(r => (
              <TableRow key={r.referred_user_id}>
                <TableCell><div className="text-sm font-medium">{r.full_name ?? "—"}</div><div className="text-xs text-muted-foreground">{r.email}</div></TableCell>
                <TableCell className="text-sm">{shortDate(r.applied_at)}</TableCell>
                <TableCell>{r.bonus_awarded_at ? <Badge>Awarded {usd(r.bonus_amount_cents)}</Badge> : <Badge variant="secondary">Pending</Badge>}</TableCell>
                <TableCell className="text-right text-sm">{r.approved_tasks}</TableCell>
                <TableCell className="text-right text-sm">{usd(r.wallet_available_cents)}</TableCell>
                <TableCell className="text-right text-sm">{usd(r.lifetime_withdrawn_cents)}</TableCell>
                <TableCell className="text-right text-sm">{usd(r.total_commission_cents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </AdminShell>
  );
}
