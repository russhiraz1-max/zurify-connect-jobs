import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Users, Gift, DollarSign, Clock, Share2, Link as LinkIcon, Trophy } from "lucide-react";
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
  head: () => ({ meta: [{ title: "Referral Dashboard — Zurify" }] }),
  component: ReferralDashboard,
});

type CodeRow = {
  id: string; code: string; status: string; max_uses: number | null; total_uses: number;
  users_referred: number; pending_bonus_users: number; awarded_bonus_users: number;
  total_bonus_cents: number; total_commission_cents: number; total_withdrawn_by_referred_cents: number;
};
type Ref = {
  referred_user_id: string; full_name: string | null; applied_at: string;
  bonus_awarded_at: string | null; bonus_amount_cents: number; total_commission_cents: number;
  wallet_available_cents: number; lifetime_withdrawn_cents: number; approved_tasks: number;
};
type TimelineRow = { event_at: string; kind: string; actor_name: string; amount_cents: number; memo: string };

function ReferralDashboard() {
  const { user } = useSession();
  const [code, setCode] = useState<CodeRow | null>(null);
  const [refs, setRefs] = useState<Ref[]>([]);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [c, r, t] = await Promise.all([
        supabase.rpc("get_my_referral_code" as never),
        supabase.rpc("get_my_referred_users" as never),
        supabase.rpc("get_my_referral_timeline" as never, { _limit: 50 } as never),
      ]);
      const arr = ((c.data ?? []) as unknown) as CodeRow[];
      setCode(arr[0] ?? null);
      setRefs(((r.data ?? []) as unknown) as Ref[]);
      setTimeline(((t.data ?? []) as unknown) as TimelineRow[]);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <AppShell title="Referral dashboard"><Card><CardContent className="p-6">Loading…</CardContent></Card></AppShell>;

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

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const referralLink = `${origin}/auth?mode=signup&ref=${code.code}`;

  async function copyText(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(msg);
    } catch {
      toast.error("Copy failed");
    }
  }

  async function share() {
    const shareData = {
      title: "Join me on Zurify",
      text: `Use my referral code ${code!.code} to join Zurify and start earning.`,
      url: referralLink,
    };
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try { await nav.share(shareData); } catch { /* user cancelled */ }
    } else {
      copyText(referralLink, "Link copied — paste it anywhere to share");
    }
  }

  const stats = [
    { label: "Friends joined", value: code.users_referred, icon: Users },
    { label: "First approved tasks", value: code.awarded_bonus_users, icon: Gift },
    { label: "Pending bonuses", value: code.pending_bonus_users, icon: Clock },
    { label: "Commission earned", value: usd(code.total_commission_cents), icon: DollarSign },
  ];

  return (
    <AppShell title="Referral dashboard" subtitle="Track your referrals, bonuses and commission.">
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase text-muted-foreground">Your referral code</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <span className="font-mono text-2xl font-bold">{code.code}</span>
              <Badge variant={code.status === "active" ? "default" : "secondary"}>{code.status}</Badge>
              <Button variant="outline" size="sm" onClick={() => copyText(code.code, "Code copied")}>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy code
              </Button>
              <Button variant="outline" size="sm" onClick={() => copyText(referralLink, "Link copied")}>
                <LinkIcon className="mr-1.5 h-3.5 w-3.5" /> Copy link
              </Button>
              <Button size="sm" onClick={share}>
                <Share2 className="mr-1.5 h-3.5 w-3.5" /> Share
              </Button>
            </div>
            <p className="mt-2 break-all rounded-md border bg-surface-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">{referralLink}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {code.total_uses} use{code.total_uses === 1 ? "" : "s"}{code.max_uses != null ? ` of ${code.max_uses}` : " (unlimited)"}
            </p>
          </div>
          <div className="grid gap-1 text-sm sm:text-right">
            <div><span className="text-muted-foreground">Referred withdrawals: </span><span className="font-semibold">{usd(code.total_withdrawn_by_referred_cents)}</span></div>
            <div><span className="text-muted-foreground">Bonus paid out: </span><span className="font-semibold">{usd(code.total_bonus_cents)}</span></div>
            <div><span className="text-muted-foreground">Lifetime referral earnings: </span><span className="font-semibold">{usd(code.total_bonus_cents + code.total_commission_cents)}</span></div>
            <div className="pt-2"><Button asChild variant="ghost" size="sm"><Link to="/referrals/leaderboard"><Trophy className="mr-1.5 h-3.5 w-3.5" /> Leaderboard</Link></Button></div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(s => (
          <Card key={s.label}><CardContent className="flex items-center gap-4 p-5">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-brand-gradient text-primary-foreground"><s.icon className="h-5 w-5" /></div>
            <div><p className="text-xs uppercase text-muted-foreground">{s.label}</p><p className="mt-1 text-xl font-semibold">{s.value}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 font-display text-lg font-semibold">Referred users</h2>
          <Card><CardContent className="p-0">
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
          </CardContent></Card>
        </div>

        <div>
          <h2 className="mb-3 font-display text-lg font-semibold">Timeline</h2>
          <Card><CardContent className="p-0">
            {timeline.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Activity will appear here.</div>
            ) : (
              <ol className="divide-y">
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
