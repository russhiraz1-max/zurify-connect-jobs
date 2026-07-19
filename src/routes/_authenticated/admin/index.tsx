import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, FileCheck2, Send, ArrowDownToLine, DollarSign, ListChecks } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { usd, dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — Zurify" }] }),
  component: AdminOverview,
});

function AdminOverview() {
  const [stats, setStats] = useState({
    users: 0, tasks: 0, pendingApps: 0, pendingSubs: 0, pendingWithdrawals: 0, paidCents: 0,
  });
  const [recent, setRecent] = useState<{ id: string; action: string; created_at: string }[]>([]);

  useEffect(() => {
    (async () => {
      const [u, t, a, s, w, tx, r] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }),
        supabase.from("task_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("task_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("withdrawal_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("wallet_transactions").select("amount_cents").eq("type", "withdrawal"),
        supabase.from("audit_logs").select("id,action,created_at").order("created_at", { ascending: false }).limit(15),
      ]);
      setStats({
        users: u.count ?? 0,
        tasks: t.count ?? 0,
        pendingApps: a.count ?? 0,
        pendingSubs: s.count ?? 0,
        pendingWithdrawals: w.count ?? 0,
        paidCents: -((tx.data ?? []).reduce((sum: number, x) => sum + ((x as { amount_cents: number }).amount_cents ?? 0), 0)),
      });
      setRecent((r.data ?? []) as { id: string; action: string; created_at: string }[]);
    })();
  }, []);

  const cards = [
    { label: "Users", value: stats.users, icon: Users },
    { label: "Tasks", value: stats.tasks, icon: ListChecks },
    { label: "Pending applications", value: stats.pendingApps, icon: Send },
    { label: "Pending submissions", value: stats.pendingSubs, icon: FileCheck2 },
    { label: "Pending withdrawals", value: stats.pendingWithdrawals, icon: ArrowDownToLine },
    { label: "Total paid out", value: usd(stats.paidCents), icon: DollarSign },
  ];

  return (
    <AdminShell title="Overview" subtitle="Snapshot of the platform.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(c => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-brand-gradient text-primary-foreground">
                <c.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
                <p className="mt-1 text-xl font-semibold">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold">Recent activity</h2>
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border text-sm">
              {recent.length === 0 && <li className="p-4 text-center text-muted-foreground">No activity yet.</li>}
              {recent.map(x => (
                <li key={x.id} className="flex items-center justify-between p-3">
                  <span className="font-mono text-xs text-muted-foreground">{x.action}</span>
                  <span className="text-xs text-muted-foreground">{dateTime(x.created_at)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
