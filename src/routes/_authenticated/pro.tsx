import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Crown, Check } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { usd, dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/pro")({
  head: () => ({
    meta: [
      { title: "Zurify Pro — Premium membership" },
      { name: "description", content: "Upgrade to Zurify Pro for priority job visibility, faster withdrawals and exclusive opportunities." },
      { property: "og:title", content: "Zurify Pro — Premium membership" },
      { property: "og:description", content: "Priority job visibility, faster withdrawals and exclusive opportunities on Zurify." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProPage,
});

type Settings = {
  pro_enabled: boolean; pro_price_cents: number; pro_duration_days: number;
  pro_benefits: string[]; pro_faq: string; pro_payment_instructions: string;
};
type Request = { id: string; status: string; created_at: string; expires_at: string | null };

function ProPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [req, setReq] = useState<Request | null>(null);
  const [note, setNote] = useState("");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [a, b] = await Promise.all([
      supabase.from("engagement_settings").select("pro_enabled,pro_price_cents,pro_duration_days,pro_benefits,pro_faq,pro_payment_instructions").eq("singleton", true).maybeSingle(),
      supabase.from("pro_requests").select("id,status,created_at,expires_at").order("created_at", { ascending: false }).limit(1),
    ]);
    setS((a.data ?? null) as unknown as Settings | null);
    setReq(((b.data ?? []) as unknown as Request[])[0] ?? null);
  }
  useEffect(() => { void load(); }, []);

  async function submit() {
    setBusy(true);
    const { error } = await supabase.rpc("request_pro" as never, { _note: note, _payment_reference: ref } as never);
    setBusy(false);
    if (error) return toast.error(error.message.replace(/^.*?:\s*/, ""));
    toast.success("Request submitted — an administrator will review it shortly");
    setNote(""); setRef("");
    void load();
  }

  if (!s) return <AppShell title="Zurify Pro"><Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card></AppShell>;

  if (!s.pro_enabled) {
    return (
      <AppShell title="Zurify Pro">
        <Card><CardContent className="p-10 text-center">
          <Crown className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Zurify Pro isn't available yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Premium membership will open soon. Keep completing jobs in the meantime.</p>
          <Button asChild className="mt-4"><Link to="/tasks">Browse jobs</Link></Button>
        </CardContent></Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Zurify Pro" subtitle="Premium membership for serious freelancers.">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-brand-gradient text-primary-foreground"><Crown className="h-5 w-5" /></span>
              <div>
                <h2 className="font-display text-xl font-semibold">Everything in Zurify Pro</h2>
                <p className="text-sm text-muted-foreground">{usd(s.pro_price_cents)} for {s.pro_duration_days} days</p>
              </div>
            </div>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {s.pro_benefits.map(b => (
                <li key={b} className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {b}
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold">How payment works</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.pro_payment_instructions}</p>
            </div>
            <div className="mt-4 rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold">Frequently asked questions</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.pro_faq}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="font-display text-lg font-semibold">Your membership</h2>
            {req ? (
              <div className="mt-4 space-y-2">
                <Badge variant={req.status === "active" ? "default" : "secondary"}>{req.status}</Badge>
                <p className="text-xs text-muted-foreground">Requested {dateTime(req.created_at)}</p>
                {req.expires_at && <p className="text-xs text-muted-foreground">Expires {dateTime(req.expires_at)}</p>}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">You don't have a membership yet.</p>
            )}

            {(!req || ["rejected", "expired", "suspended"].includes(req.status)) && (
              <div className="mt-5 space-y-3">
                <div><Label>Payment reference</Label><Input value={ref} onChange={e => setRef(e.target.value)} placeholder="PayPal transaction ID" /></div>
                <div><Label>Message (optional)</Label><Textarea rows={3} value={note} onChange={e => setNote(e.target.value)} /></div>
                <Button className="w-full" onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Request Zurify Pro"}</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
