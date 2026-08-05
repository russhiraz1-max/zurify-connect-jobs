import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Flame, Gift, Sparkles, Target, Trophy, Award, Clock, PartyPopper, Crown, ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StarRating } from "@/components/star-rating";
import { supabase } from "@/integrations/supabase/client";
import { usd, dateTime } from "@/lib/format";
import { countdown, luckyWindow, type Engagement } from "@/lib/engagement";
import { cn } from "@/lib/utils";

function rpcError(e: unknown) {
  const msg = (e as { message?: string })?.message ?? "Something went wrong";
  toast.error(msg.replace(/^.*?:\s*/, ""));
}

/* ---------------- Daily streak ---------------- */
export function StreakCard({ e, onDone }: { e: Engagement; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [ms, setMs] = useState(0);
  const s = e.streak;

  useEffect(() => {
    const tick = () => {
      const next = new Date();
      next.setUTCHours(24, 0, 0, 0);
      setMs(next.getTime() - Date.now());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const stage = s.next_day <= 7 ? 1 : s.next_day <= 14 ? 2 : 3;
  const required = stage === 1 ? 0 : stage === 2 ? e.settings.streak_stage2_required_jobs : e.settings.streak_stage3_required_jobs;
  const eligible = s.approved_last_7 >= required;

  async function claim() {
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_daily_streak" as never);
    setBusy(false);
    if (error) return rpcError(error);
    const r = data as unknown as { day: number; amount_cents: number };
    toast.success(`Day ${r.day} claimed — ${usd(r.amount_cents)} added to your wallet`);
    void supabase.rpc("sync_my_badges" as never);
    onDone();
  }

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <div className="h-1 w-full bg-brand-gradient" />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-orange-500/10 text-orange-500">
              <Flame className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Daily streak</p>
              <p className="text-xs text-muted-foreground">Stage {stage} · Day {s.next_day} of 30</p>
            </div>
          </div>
          <p className="text-2xl font-bold tabular-nums">{s.current}<span className="text-sm font-normal text-muted-foreground">d</span></p>
        </div>

        <Progress value={(s.next_day / 30) * 100} className="mt-4 h-2" />

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Today's reward</p>
            <p className="mt-0.5 font-semibold">{usd(s.next_reward_cents)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">{s.claimed_today ? "Next claim in" : "Resets in"}</p>
            <p className="mt-0.5 font-semibold tabular-nums">{countdown(ms)}</p>
          </div>
        </div>

        {required > 0 && (
          <p className={cn("mt-3 text-xs", eligible ? "text-muted-foreground" : "text-destructive")}>
            Stage {stage} needs {required} approved job{required > 1 ? "s" : ""} in the last 7 days — you have {s.approved_last_7}.
          </p>
        )}

        <Button className="mt-4 w-full" disabled={busy || s.claimed_today || !eligible} onClick={claim}>
          {s.claimed_today ? "Claimed today" : busy ? "Claiming…" : `Claim ${usd(s.next_reward_cents)}`}
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Longest {s.longest} days · {usd(s.total_claimed_cents)} earned from streaks
        </p>
      </CardContent>
    </Card>
  );
}

/* ---------------- Lucky reward ---------------- */
export function LuckyCard({ e, onDone }: { e: Engagement; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(() => luckyWindow(e.settings.lucky_open_time, e.settings.lucky_duration_minutes));

  useEffect(() => {
    const id = setInterval(() => setState(luckyWindow(e.settings.lucky_open_time, e.settings.lucky_duration_minutes)), 1000);
    return () => clearInterval(id);
  }, [e.settings.lucky_open_time, e.settings.lucky_duration_minutes]);

  const left = Math.max(0, e.settings.lucky_max_winners - e.lucky.winners_today);

  async function claim() {
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_lucky_reward" as never);
    setBusy(false);
    if (error) return rpcError(error);
    toast.success(`Lucky! ${usd((data as unknown as { amount_cents: number }).amount_cents)} credited`);
    onDone();
  }

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <div className={cn("h-1 w-full", state.open ? "bg-emerald-500" : "bg-muted")} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Clock className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Lucky reward window</p>
              <p className="text-xs text-muted-foreground">Opens daily at {e.settings.lucky_open_time.slice(0, 5)} UTC</p>
            </div>
          </div>
          <Badge variant={state.open ? "default" : "secondary"}>{state.open ? "Live now" : "Closed"}</Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Reward</p>
            <p className="mt-0.5 font-semibold">{usd(e.settings.lucky_reward_cents)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">{state.open ? "Closes in" : "Opens in"}</p>
            <p className="mt-0.5 font-semibold tabular-nums">{countdown(state.msLeft)}</p>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">{left} of {e.settings.lucky_max_winners} rewards left today</p>

        <Button className="mt-3 w-full" variant={state.open ? "default" : "outline"}
          disabled={busy || !state.open || e.lucky.claimed_today || left === 0} onClick={claim}>
          {e.lucky.claimed_today ? "Already claimed today" : left === 0 ? "All claimed" : state.open ? (busy ? "Claiming…" : "Claim reward") : "Come back later"}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------------- Mystery box ---------------- */
export function MysteryCard({ e, onDone }: { e: Engagement; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState<{ label: string; amount_cents: number } | null>(null);

  async function open() {
    setBusy(true);
    const { data, error } = await supabase.rpc("open_mystery_box" as never);
    setBusy(false);
    if (error) return rpcError(error);
    const r = data as unknown as { label: string; amount_cents: number };
    setReveal(r);
    toast.success(r.amount_cents > 0 ? `${r.label} — ${usd(r.amount_cents)}!` : r.label);
    onDone();
  }

  const shown = reveal ?? (e.mystery.opened ? e.mystery.last : null);

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <div className="h-1 w-full bg-violet-500" />
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-500/10 text-violet-600">
            <Gift className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Mystery box</p>
            <p className="text-xs text-muted-foreground">One box every {e.settings.mystery_frequency_days} days</p>
          </div>
        </div>

        <div className={cn(
          "mt-4 grid place-items-center rounded-lg border border-dashed border-border py-6 transition-transform",
          !e.mystery.opened && "hover:scale-[1.02]",
        )}>
          {shown ? (
            <div className="text-center">
              <PartyPopper className="mx-auto h-6 w-6 text-violet-500" />
              <p className="mt-2 text-sm font-semibold">{shown.label}</p>
              {shown.amount_cents > 0 && <p className="text-xs text-muted-foreground">{usd(shown.amount_cents)} credited</p>}
            </div>
          ) : (
            <div className="text-center">
              <Sparkles className="mx-auto h-6 w-6 text-violet-500" />
              <p className="mt-2 text-sm text-muted-foreground">A reward is waiting inside</p>
            </div>
          )}
        </div>

        <Button className="mt-4 w-full" disabled={busy || e.mystery.opened} onClick={open}>
          {e.mystery.opened ? "Opened — come back soon" : busy ? "Opening…" : "Open box"}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------------- Challenges ---------------- */
export function ChallengesCard({ e, onDone }: { e: Engagement; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function claim(id: string) {
    setBusy(id);
    const { data, error } = await supabase.rpc("claim_challenge" as never, { _id: id } as never);
    setBusy(null);
    if (error) return rpcError(error);
    toast.success(`Challenge reward ${usd((data as unknown as { amount_cents: number }).amount_cents)} credited`);
    onDone();
  }

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <Target className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Weekly challenges</p>
            <p className="text-xs text-muted-foreground">Complete goals for bonus rewards</p>
          </div>
        </div>

        {e.challenges.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No challenges are running right now. Check back soon.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {e.challenges.map(c => {
              const pct = Math.min(100, (c.progress / Math.max(1, c.target)) * 100);
              const done = c.progress >= c.target;
              return (
                <li key={c.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.description}</p>
                    </div>
                    <Badge className="shrink-0 bg-brand-gradient text-primary-foreground">{usd(c.reward_cents)}</Badge>
                  </div>
                  <Progress value={pct} className="mt-3 h-2" />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {c.metric === "earned_cents" ? `${usd(c.progress)} of ${usd(c.target)}` : `${c.progress} of ${c.target}`} · ends {dateTime(c.ends_at)}
                    </p>
                    <Button size="sm" variant={done && !c.claimed ? "default" : "outline"}
                      disabled={c.claimed || !done || busy === c.id} onClick={() => claim(c.id)}>
                      {c.claimed ? "Claimed" : done ? (busy === c.id ? "Claiming…" : "Claim") : "In progress"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------- Reputation ---------------- */
export function ReputationCard({ e }: { e: Engagement }) {
  const r = e.reputation;
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
              <Trophy className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{r.label}</p>
              <StarRating stars={r.stars} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums">{r.trust_score}</p>
            <p className="text-xs text-muted-foreground">Trust score</p>
          </div>
        </div>
        <Progress value={r.trust_score} className="mt-4 h-2" />
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          {[
            { label: "Approval rate", value: `${r.approval_rate}%` },
            { label: "Approved jobs", value: r.approved_jobs },
            { label: "Verified", value: r.kyc_verified ? "Yes" : "No" },
            { label: "Account age", value: `${r.account_age_days}d` },
          ].map(x => (
            <div key={x.label} className="rounded-lg border border-border p-2">
              <p className="text-muted-foreground">{x.label}</p>
              <p className="mt-0.5 font-semibold text-foreground">{x.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Your rating is calculated automatically and cannot be edited by anyone.
        </p>
      </CardContent>
    </Card>
  );
}

/* ---------------- Badges ---------------- */
export function BadgesCard({ e }: { e: Engagement }) {
  const earned = e.badges.filter(b => b.earned_at).length;
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-500/10 text-sky-600">
              <Award className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Achievements</p>
              <p className="text-xs text-muted-foreground">{earned} of {e.badges.length} unlocked</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {e.badges.map(b => (
            <span key={b.id} title={b.description}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                b.earned_at ? "border-primary/30 bg-primary/10 font-medium text-primary" : "border-border text-muted-foreground opacity-70",
              )}>
              <Award className="h-3.5 w-3.5" /> {b.name}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Pro upsell ---------------- */
export function ProCard({ e }: { e: Engagement }) {
  if (!e.settings.pro_enabled) return null;
  const status = e.pro?.status;
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <div className="h-1 w-full bg-brand-gradient" />
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <Crown className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Zurify Pro</p>
            <p className="text-xs text-muted-foreground">
              {status === "active" ? "Active membership" : status === "pending" ? "Request under review" : `${usd(e.settings.pro_price_cents)} for ${e.settings.pro_duration_days} days`}
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant={status === "active" ? "outline" : "default"}>
          <Link to="/pro">{status === "active" ? "Manage" : "Upgrade"} <ArrowRight className="ml-1 h-4 w-4" /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------------- Event banners ---------------- */
export function EventBanners({ e }: { e: Engagement }) {
  if (e.events.length === 0) return null;
  return (
    <div className="mb-6 space-y-2">
      {e.events.map(ev => (
        <div key={ev.id} className="flex items-start gap-3 rounded-lg border border-primary/20 bg-brand-gradient/5 p-4">
          <PartyPopper className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{ev.banner_text || ev.name}</p>
            {ev.description && <p className="mt-1 text-sm text-muted-foreground">{ev.description}</p>}
            <p className="mt-1 text-xs text-muted-foreground">Ends {dateTime(ev.ends_at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
