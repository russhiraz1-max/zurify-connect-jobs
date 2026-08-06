import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Wallet, Clock, TrendingUp, ArrowUpRight, Bell, Megaphone, BadgeCheck, Gift,
  Send, FileCheck2, ArrowDownToLine, ListChecks, ArrowRight, ShieldAlert,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { useEngagement } from "@/lib/engagement";
import { isJobLockedForUser, useJobProgress } from "@/lib/user-jobs";

import {
  StreakCard, LuckyCard, MysteryCard, ChallengesCard, ReputationCard, BadgesCard, ProCard, EventBanners,
} from "@/components/engagement-widgets";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Zurify" },
      { name: "description", content: "Your Zurify command center: wallet balance, tasks, applications and payouts." },
    ],
  }),
  component: DashboardPage,
});

type WalletRow = {
  available_cents: number; pending_cents: number; pending_withdrawal_cents: number;
  lifetime_earned_cents: number; lifetime_withdrawn_cents: number;
};
type Task = { id: string; title: string; description: string; reward_cents: number; est_minutes: number | null };
type NotificationRow = { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };
type Announcement = { id: string; title: string; body: string | null; created_at: string };
type Counts = { applications: number; pendingApplications: number; submissions: number; pendingSubmissions: number; withdrawals: number; pendingWithdrawals: number };
type ReferralSummary = { code: string; users_referred: number; total_commission_cents: number } | null;

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

function DashboardPage() {
  const { user } = useSession();
  const { data: eng, refresh: refreshEng } = useEngagement();
  const progress = useJobProgress();

  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [kyc, setKyc] = useState<string | null>(null);
  const [proStatus, setProStatus] = useState<string | null>(null);
  const [referral, setReferral] = useState<ReferralSummary>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<string[]>([]);


  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [w, t, n, a, apps, subs, wds, k, ref, pro] = await Promise.all([
        supabase.from("wallets")
          .select("available_cents,pending_cents,pending_withdrawal_cents,lifetime_earned_cents,lifetime_withdrawn_cents")
          .eq("user_id", user.id).maybeSingle(),
        supabase.from("tasks").select("id,title,description,reward_cents,est_minutes")
          .eq("status", "published").order("featured", { ascending: false }).order("priority", { ascending: false }).limit(6),
        supabase.from("notifications").select("id,title,body,link,read_at,created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("announcements").select("id,title,body,created_at")
          .not("published_at", "is", null).order("published_at", { ascending: false }).limit(3),
        supabase.from("task_applications").select("status").eq("user_id", user.id),
        supabase.from("task_submissions").select("status").eq("user_id", user.id),
        supabase.from("withdrawal_requests").select("status").eq("user_id", user.id),
        supabase.rpc("get_my_kyc" as never),
        supabase.rpc("get_my_referral_code" as never),
        supabase.from("pro_requests").select("status").eq("user_id", user.id)
          .order("created_at", { ascending: false }).limit(1),
      ]);

      if (cancelled) return;
      setWallet((w.data ?? null) as WalletRow | null);
      setTasks((t.data ?? []) as Task[]);
      setNotifications((n.data ?? []) as NotificationRow[]);
      setAnnouncements((a.data ?? []) as Announcement[]);
      const appRows = (apps.data ?? []) as { status: string }[];
      const subRows = (subs.data ?? []) as { status: string }[];
      const wdRows = (wds.data ?? []) as { status: string }[];
      setCounts({
        applications: appRows.length,
        pendingApplications: appRows.filter(r => r.status === "pending").length,
        submissions: subRows.length,
        pendingSubmissions: subRows.filter(r => r.status === "pending").length,
        withdrawals: wdRows.length,
        pendingWithdrawals: wdRows.filter(r => r.status === "pending").length,
      });
      setKyc(((k.data as { status: string }[] | null)?.[0]?.status) ?? null);
      setProStatus(((pro.data as { status: string }[] | null)?.[0]?.status) ?? null);
      const refRow = (ref.data as ReferralSummary[] | null)?.[0] ?? null;
      setReferral(refRow);

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const stats = [
    { label: "Available balance", value: usd(wallet?.available_cents ?? 0), icon: Wallet },
    { label: "Reserved for payout", value: usd(wallet?.pending_withdrawal_cents ?? 0), icon: Clock },
    { label: "Lifetime earned", value: usd(wallet?.lifetime_earned_cents ?? 0), icon: TrendingUp },
    { label: "Lifetime withdrawn", value: usd(wallet?.lifetime_withdrawn_cents ?? 0), icon: ArrowUpRight },
  ];

  const kycBadge = kyc === "approved"
    ? <Badge className="bg-emerald-600 text-white">Verified</Badge>
    : kyc === "pending" ? <Badge variant="secondary">Under review</Badge>
    : kyc === "rejected" ? <Badge variant="destructive">Rejected</Badge>
    : <Badge variant="outline">Not started</Badge>;

  const visibleAnnouncements = announcements.filter(a => !dismissed.includes(a.id));

  // Finished or permanently closed jobs never resurface as "available".
  const availableTasks = useMemo(
    () => tasks.filter(t => !isJobLockedForUser(t.id, progress)),
    [tasks, progress],
  );


  return (
    <AppShell title="Welcome back" subtitle="Your earnings command center.">
      {eng && <EventBanners e={eng} />}
      {proStatus === "awaiting_kyc" && kyc !== "approved" && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Zurify Pro is waiting on your identity check</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your membership activates automatically as soon as your identity verification is approved.
            </p>
          </div>
          <Button asChild size="sm" variant="outline"><Link to="/verification">Verify now</Link></Button>
        </div>
      )}

      {visibleAnnouncements.length > 0 && (
        <div className="mb-6 space-y-2">
          {visibleAnnouncements.map(a => (
            <div key={a.id} className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{a.title}</p>
                {a.body && <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{dateTime(a.created_at)}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setDismissed(d => [...d, a.id])}>Dismiss</Button>
            </div>
          ))}
        </div>
      )}

      {eng && (
        <div className="mb-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {eng.settings.streak_enabled && <StreakCard e={eng} onDone={refreshEng} />}
            {eng.settings.lucky_enabled && <LuckyCard e={eng} onDone={refreshEng} />}
            {eng.settings.mystery_enabled && <MysteryCard e={eng} onDone={refreshEng} />}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ReputationCard e={eng} />
            {eng.settings.challenges_enabled && <ChallengesCard e={eng} onDone={refreshEng} />}
          </div>
          {eng.settings.badges_enabled && <BadgesCard e={eng} />}
          <ProCard e={eng} />
        </div>
      )}


      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-gradient text-primary-foreground">
                <s.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-xl font-semibold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: "/tasks", label: "Browse tasks", icon: ListChecks },
          { to: "/submissions", label: "My submissions", icon: FileCheck2 },
          { to: "/withdrawals", label: "Withdraw funds", icon: ArrowDownToLine },
          { to: "/referrals", label: "Invite & earn", icon: Gift },
        ].map(q => (
          <Button key={q.to} asChild variant="outline" className="h-12 justify-start">
            <Link to={q.to}><q.icon className="mr-2 h-4 w-4" /> {q.label}</Link>
          </Button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Activity */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <h2 className="font-display text-lg font-semibold">Your activity</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Applications", total: counts?.applications ?? 0, pending: counts?.pendingApplications ?? 0, to: "/applications", icon: Send },
                { label: "Submissions", total: counts?.submissions ?? 0, pending: counts?.pendingSubmissions ?? 0, to: "/submissions", icon: FileCheck2 },
                { label: "Withdrawals", total: counts?.withdrawals ?? 0, pending: counts?.pendingWithdrawals ?? 0, to: "/withdrawals", icon: ArrowDownToLine },
              ].map(item => (
                <Link key={item.label} to={item.to}
                  className="rounded-lg border border-border p-4 transition-colors hover:bg-accent/40">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <item.icon className="h-4 w-4" /> {item.label}
                  </div>
                  <p className="mt-2 text-2xl font-semibold">{item.total}</p>
                  <p className="text-xs text-muted-foreground">{item.pending} pending review</p>
                </Link>
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 text-sm">
                  <BadgeCheck className="h-4 w-4 text-primary" /> Identity verification
                </div>
                <div className="flex items-center gap-2">
                  {kycBadge}
                  <Button asChild size="sm" variant="ghost"><Link to="/verification"><ArrowRight className="h-4 w-4" /></Link></Button>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm"><Gift className="h-4 w-4 text-primary" /> Referrals</div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {referral
                      ? `${referral.code} · ${referral.users_referred} referred · ${usd(referral.total_commission_cents)} commission`
                      : "No referral code assigned yet."}
                  </p>
                </div>
                <Button asChild size="sm" variant="ghost"><Link to="/referrals"><ArrowRight className="h-4 w-4" /></Link></Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Recent notifications</h2>
              <Button asChild size="sm" variant="ghost"><Link to="/notifications">All</Link></Button>
            </div>
            {notifications.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">
                {loading ? "Loading…" : "You have no notifications yet."}
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {notifications.map(n => (
                  <li key={n.id} className="flex items-start gap-2">
                    <Bell className={`mt-0.5 h-4 w-4 shrink-0 ${n.read_at ? "text-muted-foreground" : "text-primary"}`} />
                    <div className="min-w-0">
                      <p className={`truncate text-sm ${n.read_at ? "text-muted-foreground" : "font-medium"}`}>{n.title}</p>
                      <p className="text-xs text-muted-foreground">{dateTime(n.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 flex items-end justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Latest available tasks</h2>
        <Button asChild variant="outline" size="sm"><Link to="/tasks">Browse all</Link></Button>
      </div>

      {availableTasks.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            {loading ? "Loading tasks…" : "No published tasks right now. Check back soon."}
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {availableTasks.map((t) => (
            <Card key={t.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold leading-tight">{t.title}</h3>
                  <Badge className="shrink-0 bg-brand-gradient text-primary-foreground">{usd(t.reward_cents)}</Badge>
                </div>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{t.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  {t.est_minutes ? <p className="text-xs text-muted-foreground">~{t.est_minutes} min</p> : <span />}
                  <Button asChild size="sm" variant="outline">
                    <Link to="/tasks/$id" params={{ id: t.id }}>View task</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
