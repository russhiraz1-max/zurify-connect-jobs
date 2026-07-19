import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wallet as WalletIcon, Clock, TrendingUp, ArrowDownToLine } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { usd, dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Wallet — Zurify" }] }),
  component: WalletPage,
});

type Wallet = { available_cents: number; pending_cents: number; lifetime_earned_cents: number; lifetime_withdrawn_cents: number };
type Tx = { id: string; type: string; amount_cents: number; balance_after_cents: number; memo: string | null; created_at: string };

function WalletPage() {
  const { user } = useSession();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("wallets").select("available_cents,pending_cents,lifetime_earned_cents,lifetime_withdrawn_cents")
      .eq("user_id", user.id).maybeSingle().then(({ data }) => setWallet(data as Wallet | null));
    supabase.from("wallet_transactions").select("id,type,amount_cents,balance_after_cents,memo,created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setTxs((data ?? []) as Tx[]));
  }, [user?.id]);

  const stats = [
    { label: "Available", value: usd(wallet?.available_cents ?? 0), icon: WalletIcon },
    { label: "Pending", value: usd(wallet?.pending_cents ?? 0), icon: Clock },
    { label: "Lifetime earned", value: usd(wallet?.lifetime_earned_cents ?? 0), icon: TrendingUp },
    { label: "Lifetime withdrawn", value: usd(wallet?.lifetime_withdrawn_cents ?? 0), icon: ArrowDownToLine },
  ];

  return (
    <AppShell title="Wallet" subtitle="Balances update as submissions and withdrawals are processed.">
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-brand-gradient text-primary-foreground">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-xl font-semibold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Recent transactions</h2>
        <Button asChild><Link to="/withdrawals/new">Request withdrawal</Link></Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Memo</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Balance</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {txs.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="p-8 text-center text-sm text-muted-foreground">No transactions yet.</TableCell></TableRow>
              ) : txs.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">{dateTime(t.created_at)}</TableCell>
                  <TableCell><span className="text-xs uppercase text-muted-foreground">{t.type}</span></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.memo ?? "—"}</TableCell>
                  <TableCell className={`text-right font-medium ${t.amount_cents >= 0 ? "text-green-600" : "text-destructive"}`}>{t.amount_cents >= 0 ? "+" : ""}{usd(t.amount_cents)}</TableCell>
                  <TableCell className="text-right text-sm">{usd(t.balance_after_cents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
