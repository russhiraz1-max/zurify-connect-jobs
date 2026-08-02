import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users, FileCheck2, Send, ArrowDownToLine, DollarSign, ListChecks, RefreshCw, ShieldAlert,
  BadgeCheck, LifeBuoy, Flag, Gift, TrendingUp, Clock, Trophy, UserCheck, Wallet,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { usd, dateTime, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Business Analytics — Zurify Admin" },
      { name: "description", content: "Live Zurify business analytics: users, tasks, finance, referrals, staff and security." },
    ],
  }),
  component: AdminOverview,
});

type Overview = {
  users: { total: number; today: number; week: number; month: number; active_today: number; active_week: number; returning: number; verification_pending: number; suspended: number };
  tasks: { created: number; published: number; completed: number; rejected: number; pending_applications: number; pending_submissions: number; avg_completion_minutes: number };
  withdrawals: { pending: number; approved: number; rejected: number; today: number; month: number; lifetime_payout_cents: number; fee_revenue_cents: number; outstanding_cents: number };
  finance: { revenue_today_cents: number; expenses_today_cents: number; lifetime_revenue_cents: number; lifetime_expenses_cents: number; wallet_liability_cents: number; arpu_cents: number; avg_payout_cents: number };
  referrals: { codes: number; codes_used: number; uses: number; converted: number; bonus_paid_cents: number; commission_paid_cents: number; active_campaigns: number; growth_30d: number };
  staff: { applications_reviewed: number; submissions_reviewed: number; withdrawals_approved: number; avg_review_minutes: number; tickets_resolved: number; announcements: number };
  security: { suspended: number; kyc_pending: number; withdrawal_holds: number; open_reports: number };
  today: { new_users: number; completed_tasks: number; withdrawals_cents: number; referral_bonus_cents: number; commission_cents: number; expenses_cents: number };
  recent_security_events: { action: string; created_at: string; target_type: string | null }[];
  top_referrers: { name: string; referrals: number; commission_cents: number }[];
};

type SeriesRow = {
  day: string; signups: number; tasks_completed: number; referrals: number;
  revenue_cents: number; expenses_cents: number; profit_cents: number;
  withdrawals: number; payout_cents: number;
};

type CampaignAgg = { name: string; codes: number; referrals: number; commission: number };

function AdminOverview() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignAgg[]>([]);
  const [openTickets, setOpenTickets] = useState(0);
  const [kycSeries, setKycSeries] = useState<{ day: string; count: number }[]>([]);
  const [days, setDays] = useState("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const n = parseInt(days, 10);
    const since = new Date(Date.now() - (n - 1) * 864e5);
    since.setHours(0, 0, 0, 0);
    const [o, s, t, k, c] = await Promise.all([
      supabase.rpc("admin_analytics_overview" as never),
      supabase.rpc("admin_analytics_series" as never, { _days: n } as never),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "pending"]),
      supabase.from("kyc_verifications").select("created_at").gte("created_at", since.toISOString()),
      supabase.rpc("admin_list_referral_codes" as never),
    ]);
    if (o.error) setError(o.error.message);
    setOv((o.data ?? null) as unknown as Overview | null);
    setSeries(((s.data ?? []) as unknown) as SeriesRow[]);
    setOpenTickets(t.count ?? 0);

    const buckets = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      const d = new Date(since.getTime() + i * 864e5).toISOString().slice(0, 10);
      buckets.set(d, 0);
    }
    for (const row of (((k.data ?? []) as unknown) as { created_at: string }[])) {
      const d = row.created_at.slice(0, 10);
      if (buckets.has(d)) buckets.set(d, (buckets.get(d) ?? 0) + 1);
    }
    setKycSeries([...buckets].map(([day, count]) => ({ day, count })));

    const codes = ((c.data ?? []) as unknown) as { campaign_name: string | null; users_referred: number; total_commission_cents: number }[];
    const agg = new Map<string, CampaignAgg>();
    for (const row of codes) {
      const name = row.campaign_name ?? "Standard program";
      const cur = agg.get(name) ?? { name, codes: 0, referrals: 0, commission: 0 };
      cur.codes += 1; cur.referrals += Number(row.users_referred); cur.commission += Number(row.total_commission_cents);
      agg.set(name, cur);
    }
    setCampaigns([...agg.values()].sort((a, b) => b.referrals - a.referrals).slice(0, 5));

    setRefreshedAt(new Date());
    setLoading(false);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const chartData = useMemo(() => series.map((r, i) => ({
    day: shortDate(r.day),
    signups: Number(r.signups),
    tasks: Number(r.tasks_completed),
    referrals: Number(r.referrals),
    revenue: Number(r.revenue_cents) / 100,
    expenses: Number(r.expenses_cents) / 100,
    profit: Number(r.profit_cents) / 100,
    withdrawals: Number(r.withdrawals),
    payout: Number(r.payout_cents) / 100,
    kyc: kycSeries[i]?.count ?? 0,
  })), [series, kycSeries]);

  if (loading && !ov) {
    return (
      <AdminShell title="Business analytics" subtitle="Loading live platform data…">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><div className="h-16 animate-pulse rounded-md bg-muted" /></CardContent></Card>
          ))}
        </div>
      </AdminShell>
    );
  }

  if (error || !ov) {
    return (
      <AdminShell title="Business analytics">
        <Card className="border-destructive/40"><CardContent className="space-y-3 p-8 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
          <p className="text-sm">{error ?? "Analytics are unavailable right now."}</p>
          <Button onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Try again</Button>
        </CardContent></Card>
      </AdminShell>
    );
  }

  const growthRate = ov.users.total - ov.users.month > 0
    ? Math.round((ov.users.month / (ov.users.total - ov.users.month)) * 100)
    : ov.users.month > 0 ? 100 : 0;
  const completionRate = ov.tasks.completed + ov.tasks.rejected > 0
    ? Math.round((ov.tasks.completed / (ov.tasks.completed + ov.tasks.rejected)) * 100) : 0;
  const conversion = ov.referrals.uses > 0 ? Math.round((ov.referrals.converted / ov.referrals.uses) * 100) : 0;
  const monthRevenue = series.reduce((a, r) => a + Number(r.revenue_cents), 0);
  const monthExpenses = series.reduce((a, r) => a + Number(r.expenses_cents), 0);
  const lifetimeProfit = ov.finance.lifetime_revenue_cents - ov.finance.lifetime_expenses_cents;

  return (
    <AdminShell title="Business analytics" subtitle="Live platform performance across users, tasks, finance, referrals and security.">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
        {refreshedAt && <span className="text-xs text-muted-foreground">Updated {refreshedAt.toLocaleTimeString()}</span>}
      </div>

      <Section title="Review queue" subtitle="Where work is waiting right now.">
        <Grid>
          <Stat label="Pending applications" value={ov.tasks.pending_applications} icon={Send} tone={ov.tasks.pending_applications ? "warn" : "default"} />
          <Stat label="Pending submissions" value={ov.tasks.pending_submissions} icon={FileCheck2} tone={ov.tasks.pending_submissions ? "warn" : "default"} />
          <Stat label="Pending withdrawals" value={ov.withdrawals.pending} icon={ArrowDownToLine} tone={ov.withdrawals.pending ? "warn" : "default"} />
          <Stat label="Pending verification" value={ov.security.kyc_pending} icon={BadgeCheck} tone={ov.security.kyc_pending ? "warn" : "default"} />
          <Stat label="Open support tickets" value={openTickets} icon={LifeBuoy} />
          <Stat label="Fraud reports" value={ov.security.open_reports} icon={Flag} tone={ov.security.open_reports ? "danger" : "default"} />
        </Grid>
      </Section>

      <Section title="Users">
        <Grid>
          <Stat label="Total users" value={ov.users.total} icon={Users} />
          <Stat label="Signups today" value={ov.users.today} icon={UserCheck} />
          <Stat label="Signups this week" value={ov.users.week} icon={UserCheck} />
          <Stat label="Signups this month" value={ov.users.month} icon={UserCheck} />
          <Stat label="Active today" value={ov.users.active_today} icon={TrendingUp} />
          <Stat label="Active this week" value={ov.users.active_week} icon={TrendingUp} />
          <Stat label="Returning users (30d)" value={ov.users.returning} icon={Users} />
          <Stat label="Growth rate (month)" value={`${growthRate}%`} icon={TrendingUp} />
        </Grid>
      </Section>

      <Section title="Tasks">
        <Grid>
          <Stat label="Completed today" value={ov.today.completed_tasks} icon={ListChecks} />
          <Stat label="Approved (all time)" value={ov.tasks.completed} icon={FileCheck2} />
          <Stat label="Rejected" value={ov.tasks.rejected} icon={FileCheck2} />
          <Stat label="Pending review" value={ov.tasks.pending_submissions} icon={Clock} />
          <Stat label="Avg completion time" value={`${ov.tasks.avg_completion_minutes} min`} icon={Clock} />
          <Stat label="Completion rate" value={`${completionRate}%`} icon={TrendingUp} />
        </Grid>
      </Section>

      <Section title="Finance">
        <Grid>
          <Stat label="Revenue today" value={usd(ov.finance.revenue_today_cents)} icon={DollarSign} />
          <Stat label={`Revenue (last ${days}d)`} value={usd(monthRevenue)} icon={DollarSign} />
          <Stat label="Lifetime revenue" value={usd(ov.finance.lifetime_revenue_cents)} icon={DollarSign} />
          <Stat label="Expenses today" value={usd(ov.finance.expenses_today_cents)} icon={Wallet} />
          <Stat label={`Expenses (last ${days}d)`} value={usd(monthExpenses)} icon={Wallet} />
          <Stat label="Lifetime expenses" value={usd(ov.finance.lifetime_expenses_cents)} icon={Wallet} />
          <Stat label="Profit today" value={usd(ov.finance.revenue_today_cents - ov.finance.expenses_today_cents)} icon={TrendingUp} />
          <Stat label={`Profit (last ${days}d)`} value={usd(monthRevenue - monthExpenses)} icon={TrendingUp} />
          <Stat label="Lifetime profit" value={usd(lifetimeProfit)} icon={TrendingUp} tone={lifetimeProfit < 0 ? "danger" : "default"} />
          <Stat label="Withdrawal fees earned" value={usd(ov.withdrawals.fee_revenue_cents)} icon={DollarSign} />
          <Stat label="Total paid to workers" value={usd(ov.withdrawals.lifetime_payout_cents)} icon={ArrowDownToLine} />
          <Stat label="Wallet liability" value={usd(ov.finance.wallet_liability_cents)} icon={Wallet} />
          <Stat label="Avg revenue per user" value={usd(ov.finance.arpu_cents)} icon={DollarSign} />
          <Stat label="Avg payout per user" value={usd(ov.finance.avg_payout_cents)} icon={ArrowDownToLine} />
          <Stat label="Outstanding withdrawals" value={usd(ov.withdrawals.outstanding_cents)} icon={Clock} />
        </Grid>
      </Section>

      <Section title="Trends" subtitle={`Daily activity over the last ${days} days.`}>
        {chartData.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Daily user growth">
              <AreaChart data={chartData}>
                {axes()}
                <Area type="monotone" dataKey="signups" name="Signups" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.18} />
              </AreaChart>
            </ChartCard>
            <ChartCard title="Revenue, expenses and profit (USD)">
              <LineChart data={chartData}>
                {axes()}
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--primary))" dot={false} />
                <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#f97316" dot={false} />
                <Line type="monotone" dataKey="profit" name="Profit" stroke="#10b981" dot={false} />
              </LineChart>
            </ChartCard>
            <ChartCard title="Withdrawals and payouts">
              <BarChart data={chartData}>
                {axes()}
                <Legend />
                <Bar dataKey="withdrawals" name="Requests" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="payout" name="Paid (USD)" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>
            <ChartCard title="Task completion">
              <AreaChart data={chartData}>
                {axes()}
                <Area type="monotone" dataKey="tasks" name="Approved tasks" stroke="#10b981" fill="#10b981" fillOpacity={0.18} />
              </AreaChart>
            </ChartCard>
            <ChartCard title="Referral growth">
              <AreaChart data={chartData}>
                {axes()}
                <Area type="monotone" dataKey="referrals" name="New referrals" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.18} />
              </AreaChart>
            </ChartCard>
            <ChartCard title="Verification activity">
              <BarChart data={chartData}>
                {axes()}
                <Bar dataKey="kyc" name="KYC submissions" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>
          </div>
        )}
      </Section>

      <Section title="Referrals">
        <Grid>
          <Stat label="Bonuses paid" value={usd(ov.referrals.bonus_paid_cents)} icon={Gift} />
          <Stat label="Commissions paid" value={usd(ov.referrals.commission_paid_cents)} icon={Gift} />
          <Stat label="Conversion rate" value={`${conversion}%`} icon={TrendingUp} />
          <Stat label="Active codes" value={ov.referrals.codes_used} icon={Gift} />
          <Stat label="Total codes" value={ov.referrals.codes} icon={Gift} />
          <Stat label="Active campaigns" value={ov.referrals.active_campaigns} icon={Trophy} />
          <Stat label="Referrals (30d)" value={ov.referrals.growth_30d} icon={TrendingUp} />
          <Stat label="Successful referrals" value={ov.referrals.converted} icon={UserCheck} />
        </Grid>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ListCard title="Top referrers" empty="No qualifying referrers yet.">
            {ov.top_referrers.map((r, i) => (
              <li key={i} className="flex items-center justify-between p-3 text-sm">
                <span className="flex items-center gap-2"><Badge variant="secondary">#{i + 1}</Badge> {r.name}</span>
                <span className="text-muted-foreground">{r.referrals} referrals · {usd(r.commission_cents)}</span>
              </li>
            ))}
          </ListCard>
          <ListCard title="Top campaigns" empty="No campaign data yet.">
            {campaigns.map(c => (
              <li key={c.name} className="flex items-center justify-between p-3 text-sm">
                <span>{c.name} <span className="text-xs text-muted-foreground">({c.codes} code{c.codes === 1 ? "" : "s"})</span></span>
                <span className="text-muted-foreground">{c.referrals} referrals · {usd(c.commission)}</span>
              </li>
            ))}
          </ListCard>
        </div>
      </Section>

      <Section title="Staff performance">
        <Grid>
          <Stat label="Applications reviewed" value={ov.staff.applications_reviewed} icon={Send} />
          <Stat label="Submissions reviewed" value={ov.staff.submissions_reviewed} icon={FileCheck2} />
          <Stat label="Withdrawals approved" value={ov.staff.withdrawals_approved} icon={ArrowDownToLine} />
          <Stat label="Avg review time" value={`${ov.staff.avg_review_minutes} min`} icon={Clock} />
          <Stat label="Tickets resolved" value={ov.staff.tickets_resolved} icon={LifeBuoy} />
          <Stat label="Announcements published" value={ov.staff.announcements} icon={TrendingUp} />
        </Grid>
      </Section>

      <Section title="Security">
        <Grid>
          <Stat label="Suspended users" value={ov.security.suspended} icon={ShieldAlert} tone={ov.security.suspended ? "danger" : "default"} />
          <Stat label="Withdrawal holds" value={ov.security.withdrawal_holds} icon={ShieldAlert} />
          <Stat label="Pending KYC" value={ov.security.kyc_pending} icon={BadgeCheck} />
          <Stat label="Open fraud reports" value={ov.security.open_reports} icon={Flag} />
        </Grid>
        <div className="mt-4">
          <ListCard title="Recent security events" empty="No security events recorded.">
            {ov.recent_security_events.map((e, i) => (
              <li key={i} className="flex items-center justify-between p-3 text-sm">
                <span className="font-mono text-xs">{e.action}{e.target_type ? ` · ${e.target_type}` : ""}</span>
                <span className="text-xs text-muted-foreground">{dateTime(e.created_at)}</span>
              </li>
            ))}
          </ListCard>
        </div>
      </Section>
    </AdminShell>
  );
}

function axes() {
  return (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
      <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" stroke="hsl(var(--muted-foreground))" />
      <YAxis tick={{ fontSize: 11 }} width={44} stroke="hsl(var(--muted-foreground))" />
      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }} />
    </>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 animate-in fade-in duration-500">
      <div className="mb-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;
}

function Stat({ label, value, icon: Icon, tone = "default" }:
  { label: string; value: string | number; icon: typeof Users; tone?: "default" | "warn" | "danger" }) {
  const toneCls = tone === "danger" ? "bg-destructive text-destructive-foreground"
    : tone === "warn" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
    : "bg-brand-gradient text-primary-foreground";
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${toneCls}`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="mb-3 text-sm font-medium">{title}</p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
      No activity recorded in this period yet.
    </CardContent></Card>
  );
}

function ListCard({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.flat().filter(Boolean).length > 0;
  return (
    <Card>
      <CardContent className="p-0">
        <p className="border-b p-4 text-sm font-medium">{title}</p>
        {hasItems ? <ul className="divide-y">{children}</ul> : <p className="p-6 text-center text-sm text-muted-foreground">{empty}</p>}
      </CardContent>
    </Card>
  );
}
