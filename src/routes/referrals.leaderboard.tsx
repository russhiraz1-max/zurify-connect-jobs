import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { usd } from "@/lib/format";

export const Route = createFileRoute("/referrals/leaderboard")({
  head: () => ({
    meta: [
      { title: "Referral Leaderboard — Zurify" },
      { name: "description", content: "See the top Zurify referrers and their earnings. Updated live." },
      { property: "og:title", content: "Referral Leaderboard — Zurify" },
      { property: "og:description", content: "Top Zurify partners ranked by successful referrals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeaderboardPage,
});

type Row = { rank: number; owner_user_id: string; display_name: string; successful_referrals: number; commission_earned_cents: number };

function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_referral_leaderboard" as never, { _limit: 50 } as never);
      setRows(((data ?? []) as unknown) as Row[]);
      setLoading(false);
    })();
  }, []);
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="border-b border-border/60 bg-surface-muted/50">
          <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-primary-foreground"><Trophy className="h-5 w-5" /></div>
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight">Referral leaderboard</h1>
                <p className="mt-1 text-sm text-muted-foreground">Top Zurify partners ranked by successful referrals.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Member</TableHead>
                <TableHead className="text-right">Successful referrals</TableHead>
                <TableHead className="text-right">Commission earned</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="p-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="p-8 text-center text-sm text-muted-foreground">No qualifying referrals yet. Be the first!</TableCell></TableRow>
                ) : rows.map(r => (
                  <TableRow key={r.owner_user_id}>
                    <TableCell className="font-mono text-sm font-semibold">#{r.rank}</TableCell>
                    <TableCell className="text-sm font-medium">{r.display_name}</TableCell>
                    <TableCell className="text-right text-sm">{r.successful_referrals}</TableCell>
                    <TableCell className="text-right text-sm">{usd(r.commission_earned_cents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
          <p className="mt-4 text-center text-xs text-muted-foreground">Only usernames are shown. Emails are never exposed.</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
