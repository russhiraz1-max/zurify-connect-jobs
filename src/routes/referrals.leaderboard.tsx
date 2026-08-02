import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Trophy, Search, Minus, ArrowUp } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { usd } from "@/lib/format";

export const Route = createFileRoute("/referrals/leaderboard")({
  head: () => ({
    meta: [
      { title: "Referral Leaderboard — Zurify" },
      { name: "description", content: "See the top Zurify referrers, their badges and their earnings. Updated live." },
      { property: "og:title", content: "Referral Leaderboard — Zurify" },
      { property: "og:description", content: "Top Zurify partners ranked by successful referrals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeaderboardPage,
});

type Row = {
  rank: number; owner_user_id: string; display_name: string;
  successful_referrals: number; commission_earned_cents: number;
  month_referrals: number; week_referrals: number; badge: string;
};

type Campaign = { name: string; ends_at: string; prize: string };

const badgeClass = (b: string) =>
  b === "Diamond" ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
    : b === "Platinum" ? "bg-violet-500/15 text-violet-600 dark:text-violet-400"
    : b === "Gold" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
    : b === "Silver" ? "bg-slate-400/20 text-slate-600 dark:text-slate-300"
    : "bg-orange-500/15 text-orange-600 dark:text-orange-400";

function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [l, c] = await Promise.all([
        supabase.rpc("get_referral_leaderboard" as never, { _limit: 50 } as never),
        supabase.from("referral_campaigns").select("name,ends_at,prize").eq("status", "active").order("ends_at").limit(1),
      ]);
      if (l.error) setError(l.error.message);
      setRows(((l.data ?? []) as unknown) as Row[]);
      setCampaign((((c.data ?? []) as unknown) as Campaign[])[0] ?? null);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () => rows.filter(r => !q || r.display_name.toLowerCase().includes(q.toLowerCase())),
    [rows, q],
  );

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="border-b border-border/60 bg-surface-muted/50">
          <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-primary-foreground"><Trophy className="h-5 w-5" /></div>
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight">Referral leaderboard</h1>
                <p className="mt-1 text-sm text-muted-foreground">Top Zurify partners ranked by successful referrals.</p>
              </div>
            </div>
            {campaign && (
              <div className="mt-5 rounded-lg border bg-background p-4 text-sm">
                <span className="font-medium">Current campaign: {campaign.name}</span>
                <span className="text-muted-foreground"> · Prize: {campaign.prize} · Ends {new Date(campaign.ends_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="relative mb-4 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search members" className="pl-9" />
          </div>

          {error && <Card className="mb-4 border-destructive/40"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}

          <Card><CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-14">Rank</TableHead>
                  <TableHead>Badge</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Successful</TableHead>
                  <TableHead className="text-right">This week</TableHead>
                  <TableHead className="text-right">This month</TableHead>
                  <TableHead className="text-right">Lifetime</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Trend</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={9} className="p-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="p-8 text-center text-sm text-muted-foreground">
                      {q ? "No members match your search." : "No qualifying referrals yet. Be the first!"}
                    </TableCell></TableRow>
                  ) : filtered.map(r => (
                    <TableRow key={r.owner_user_id}>
                      <TableCell className="font-mono text-sm font-semibold">#{r.rank}</TableCell>
                      <TableCell><Badge variant="secondary" className={badgeClass(r.badge)}>{r.badge}</Badge></TableCell>
                      <TableCell className="text-sm font-medium">{r.display_name}</TableCell>
                      <TableCell className="text-right text-sm">{r.successful_referrals}</TableCell>
                      <TableCell className="text-right text-sm">{r.week_referrals}</TableCell>
                      <TableCell className="text-right text-sm">{r.month_referrals}</TableCell>
                      <TableCell className="text-right text-sm">{r.successful_referrals}</TableCell>
                      <TableCell className="text-right text-sm">{usd(r.commission_earned_cents)}</TableCell>
                      <TableCell className="text-right">
                        {r.week_referrals > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><ArrowUp className="h-3 w-3" /> Rising</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="h-3 w-3" /> Steady</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent></Card>
          <p className="mt-4 text-center text-xs text-muted-foreground">Only public display names and referral statistics are shown. Email addresses are never exposed.</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
