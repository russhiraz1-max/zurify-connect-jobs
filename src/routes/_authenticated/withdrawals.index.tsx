import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { usd, dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/withdrawals")({
  head: () => ({ meta: [{ title: "Withdrawals — Zurify" }] }),
  component: WithdrawalsPage,
});

type Row = {
  id: string; amount_cents: number; fee_cents: number; net_cents: number;
  status: string; method: string; destination: { paypal_email?: string };
  created_at: string; processed_at: string | null; rejection_reason: string | null;
};

function WithdrawalsPage() {
  const { user } = useSession();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("withdrawal_requests")
      .select("id,amount_cents,fee_cents,net_cents,status,method,destination,created_at,processed_at,rejection_reason")
      .eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, [user?.id]);

  return (
    <AppShell title="Withdrawals" subtitle="Withdraw your earnings to PayPal.">
      <div className="mb-4 flex justify-end">
        <Button asChild><Link to="/withdrawals/new">Request withdrawal</Link></Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Requested</TableHead><TableHead>Amount</TableHead><TableHead>Fee</TableHead><TableHead>Net</TableHead><TableHead>PayPal</TableHead><TableHead>Status</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="p-8 text-center text-sm text-muted-foreground">No withdrawals yet.</TableCell></TableRow>
              ) : rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{dateTime(r.created_at)}</TableCell>
                  <TableCell>{usd(r.amount_cents)}</TableCell>
                  <TableCell>{usd(r.fee_cents)}</TableCell>
                  <TableCell className="font-medium">{usd(r.net_cents)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.destination?.paypal_email ?? "—"}</TableCell>
                  <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
