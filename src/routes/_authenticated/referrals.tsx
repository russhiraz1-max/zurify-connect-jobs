import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Copy, Users, Gift, DollarSign, Clock, Share2, Link as LinkIcon, Trophy, Download, CalendarClock, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { shortDate, usd, dateTime } from "@/lib/format";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/referrals")({
  head: () => ({
    meta: [
      { title: "Referral Dashboard — Zurify" },
      { name: "description", content: "Track your Zurify referrals, bonuses, commission and campaign performance." },
    ],
  }),
  component: ReferralDashboard,
});

type CodeRow = {
  id: string; code: string; status: string; max_uses: number | null; total_uses: number;
  users_referred: number; pending_bonus_users: number; awarded_bonus_users: number;
  total_bonus_cents: number; total_commission_cents: number; total_withdrawn_by_referred_cents: number;
  campaign_name: string | null; description: string | null; expires_at: string | null;
  welcome_bonus_cents: number; commission_bps: number; commission_duration_days: number | null;
  leaderboard_eligible: boolean; next_commission_expiry: string | null;
  leaderboard_rank: number | null; commission_last_30_cents: number;
};
type Ref = {
  referred_user_id: string; full_name: string | null; applied_at: string;
  bonus_awarded_at: string | null; bonus_amount_cents: number; total_commission_cents: number;
  wallet_available_cents: number; lifetime_withdrawn_cents: number; approved_tasks: number;
};
type TimelineRow = { event_at: string; kind: string; actor_name: string; amount_cents: number; memo: string };
type Tx = { amount_cents: number; created_at: string; type: string };

function ReferralDashboard() {
  const { user } = useSession();
  const [code, setCode] = useState<CodeRow | null>(null);
  const [refs, setRefs] = useState<Ref[]>([]);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [c, r, t, w] = await Promise.all([
        supabase.rpc("get_my_referral_code" as never),
        supabase.rpc("get_my_referred_users" as never),
        supabase.rpc("get_my_referral_timeline" as never, { _limit: 50 } as never),
        supabase.from("wallet_transactions").select("amount_cents,created_at,type")
          .eq("user_id", user.id).in("type", ["referral_bonus", "referral_commission"]),
      ]);
      const arr = ((c.data ?? []) as unknown) as CodeRow[];
      setCode(arr[0] ?? null);
      setRefs(((r.data ?? []) as unknown) as Ref[]);
      setTimeline(((t.data ?? []) as unknown) as TimelineRow[]);
      setTxs(((w.data ?? []) as unknown) as Tx[]);
      setLoading(false);
    })();
  }, [user]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const referralLink = code ? `${origin}/auth?mode=signup&ref=${code.code}` : "";

  useEffect(() => {
    if (!referralLink) return;
    QRCode.toDataURL(referralLink, { width: 320, margin: 1 }).then(setQr).catch(() => setQr(null));
  }, [referralLink]);

  if (loading) {
    return (
      <AppShell title="Referral dashboard">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><div className="h-14 animate-pulse rounded-md bg-muted" /></CardContent></Card>
          ))}
        </div>
      </AppShell>
    );
  }

  if (!code) {
    return (
      <AppShell title="Referral dashboard" subtitle="Bring new users to Zurify and earn.">
        <Card><CardContent className="p-8 text-center">
          <Gift className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 font-display text-lg font-semibold">No referral code assigned</h2>
          <p className="mt-2 text-sm text-muted-foreground">Referral codes are issued by administrators to selected partners, ambassadors and creators. If you'd like to join the program, contact the Zurify team.</p>
          <div className="mt-6">
            <Button asChild variant="outline"><Link to="/referrals/leaderboard"><Trophy className="mr-2 h-4 w-4" /> View leaderboard</Link></Button>
          </div>
        </CardContent></Card>
      </AppShell>
    );
  }

  const now = Date.now();
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
  const sum = (from: number) => txs.filter(x => +new Date(x.created_at) >= from).reduce((a, x) => a + x.amount_cents, 0);
  const earnedToday = sum(+startOfDay);
  const earnedWeek = sum(now - 7 * 864e5);
  const earnedMonth = sum(+startOfMonth);
  const earnedLifetime = txs.reduce((a, x) => a + x.amount_cents, 0);
  const pendingBonusValue = code.pending_bonus_users * code.welcome_bonus_cents;

  const expiryDays = code.next_commission_expiry
    ? Math.max(0, Math.ceil((+new Date(code.next_commission_expiry) - now) / 864e5))
    : null;
  const codeExpired = code.expires_at ? +new Date(code.expires_at) < now : false;

  async function copyText(text: string, msg: string) {
    try { await navigator.clipboard.writeText(text); toast.success(msg); }
    catch { toast.error("Copy failed"); }
  }

  async function share() {
    const shareData = {
      title: "Join me on Zurify",
      text: `Use my referral code ${code!.code} to join Zurify and start earning.`,
      url: referralLink,
    };
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) { try { await nav.share(shareData); } catch { /* cancelled */ } }
    else copyText(referralLink, "Link copied — paste it anywhere to share");
  }

  function downloadQr() {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr; a.download = `zurify-${code!.code}.png`; a.click();
  }

  const earnings = [
    { label: "Today", value: usd(earnedToday), icon: DollarSign },
    { label: "This week", value: usd(earnedWeek), icon: TrendingUp },
    { label: "This month", value: usd(earnedMonth), icon: TrendingUp },
    { label: "Lifetime", value: usd(earnedLifetime), icon: Gift },
  ];
  const stats = [
    { label: "Successful referrals", value: code.awarded_bonus_users, icon: Gift },
    { label: "Pending referrals", value: code.pending_bonus_users, icon: Clock },
    { label: "Pending bonuses (est.)", value: usd(pendingBonusValue), icon: Clock },
    { label: "Total joined", value: code.users_referred, icon: Users },
  ];

  return (
    <AppShell title="Referral dashboard" subtitle="Track your referrals, bonuses and commission.">
      <Card className="mb-6">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <p className="text-xs uppercase text-muted-foreground">Your referral code</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <span className="font-mono text-2xl font-bold">{code.code}</span>
              <Badge variant={code.status === "active" && !codeExpired ? "default" : "secondary"}>
                {codeExpired ? "expired" : code.status}
              </Badge>
              {code.leaderboard_rank != null && <Badge variant="outline"><Trophy className="mr-1 h-3 w-3" /> Rank #{code.leaderboard_rank}</Badge>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => copyText(code.code, "Code copied")}><Copy className="mr-1.5 h-3.5 w-3.5" /> Copy code</Button>
              <Button variant="outline" size="sm" onClick={() => copyText(referralLink, "Link copied")}><LinkIcon className="mr-1.5 h-3.5 w-3.5" /> Copy link</Button>
              <Button size="sm" onClick={share}><Share2 className="mr-1.5 h-3.5 w-3.5" /> Share</Button>
            </div>
            <p className="mt-3 break-all rounded-md border bg-surface-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">{referralLink}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Detail label="Campaign" value={code.campaign_name ?? "Standard program"} sub={code.description ?? undefined} />
              <Detail label="Commission rate" value={`${(code.commission_bps / 100).toFixed(2).replace(/\.00$/, "")}% of referred withdrawals`} />
              <Detail label="Welcome bonus" value={`${usd(code.welcome_bonus_cents)} per first approved task`} />
              <Detail
                label="Commission duration"
                value={code.commission_duration_days ? `${code.commission_duration_days} days per referral` : "Never expires"}
                sub={expiryDays != null ? `Next expiry in ${expiryDays} day${expiryDays === 1 ? "" : "s"}` : undefined}
              />
              <Detail label="Uses" value={`${code.total_uses}${code.max_uses != null ? ` of ${code.max_uses}` : " (unlimited)"}`} />
              <Detail
                label="Code expiry"
                value={code.expires_at ? shortDate(code.expires_at) : "No expiry"}
                sub={code.leaderboard_eligible ? "Leaderboard eligible" : "Not on leaderboard"}
              />
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 justify-self-center">
            {qr ? (
              <img src={qr} alt={`QR code for referral link ${code.code}`} className="h-40 w-40 rounded-lg border bg-white p-2" />
            ) : (
              <div className="grid h-40 w-40 place-items-center rounded-lg border text-xs text-muted-foreground">QR unavailable</div>
            )}
            <Button variant="ghost" size="sm" onClick={downloadQr} disabled={!qr}><Download className="mr-1.5 h-3.5 w-3.5" /> Download QR</Button>
            <Button asChild variant="ghost" size="sm"><Link to="/referrals/leaderboard"><Trophy className="mr-1.5 h-3.5 w-3.5" /> Leaderboard</Link></Button>
          </div>
        </CardContent>
      </Card>

      {expiryDays != null && expiryDays <= 30 && (
        <Card className="mb-6 border-primary/40">
          <CardContent className="flex items-center gap-3 p-4 text-sm">
            <CalendarClock className="h-4 w-4 text-primary" />
            <span>Your earliest commission window closes in <strong>{expiryDays} day{expiryDays === 1 ? "" : "s"}</strong> ({dateTime(code.next_commission_expiry)}).</span>
          </CardContent>
        </Card>
      )}

      <h2 className="mb-3 font-display text-lg font-semibold">Earnings</h2>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {earnings.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold">Referral performance</h2>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 font-display text-lg font-semibold">Referred users</h2>
          <Card><CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>User</TableHead><TableHead>Joined</TableHead>
                  <TableHead className="text-right">Approved</TableHead>
                  <TableHead className="text-right">Withdrawn</TableHead>
                  <TableHead>Bonus</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {refs.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="p-8 text-center text-sm text-muted-foreground">No referrals yet — share your code!</TableCell></TableRow>
                  ) : refs.map(r => (
                    <TableRow key={r.referred_user_id}>
                      <TableCell className="text-sm font-medium">{r.full_name ?? "Member"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{shortDate(r.applied_at)}</TableCell>
                      <TableCell className="text-right text-sm">{r.approved_tasks}</TableCell>
                      <TableCell className="text-right text-sm">{usd(r.lifetime_withdrawn_cents)}</TableCell>
                      <TableCell>{r.bonus_awarded_at ? <Badge>Awarded</Badge> : <Badge variant="secondary">Pending</Badge>}</TableCell>
                      <TableCell className="text-right text-sm">{usd(r.total_commission_cents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent></Card>
        </div>

        <div>
          <h2 className="mb-3 font-display text-lg font-semibold">Recent activity</h2>
          <Card><CardContent className="p-0">
            {timeline.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Activity will appear here.</div>
            ) : (
              <ol className="max-h-[560px] divide-y overflow-y-auto">
                {timeline.map((t, i) => (
                  <li key={i} className="flex items-start gap-3 p-4">
                    <TimelineDot kind={t.kind} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm"><span className="font-medium">{t.actor_name}</span> {timelineLabel(t)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{dateTime(t.event_at)}</p>
                    </div>
                    {t.amount_cents > 0 && <Badge variant="secondary">+{usd(t.amount_cents)}</Badge>}
                  </li>
                ))}
              </ol>
            )}
          </CardContent></Card>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Users }) {
  return (
    <Card><CardContent className="flex items-center gap-4 p-5">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-gradient text-primary-foreground"><Icon className="h-5 w-5" /></div>
      <div className="min-w-0">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-xl font-semibold">{value}</p>
      </div>
    </CardContent></Card>
  );
}

function Detail({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function TimelineDot({ kind }: { kind: string }) {
  const cls = kind === "welcome_bonus" ? "bg-emerald-500"
    : kind === "commission" ? "bg-primary"
    : "bg-muted-foreground";
  return <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

function timelineLabel(t: TimelineRow): string {
  if (t.kind === "joined") return "joined via your code";
  if (t.kind === "welcome_bonus") return "completed first approved task — welcome bonus awarded";
  if (t.kind === "commission") return "withdrawal approved — commission credited";
  return t.memo;
}
