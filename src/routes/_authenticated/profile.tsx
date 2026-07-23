import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Gift, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { shortDate, usd } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — Zurify" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: "", headline: "", bio: "", location: "", website: "" });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (data) {
        setForm({
          full_name: data.full_name ?? "",
          headline: data.headline ?? "",
          bio: data.bio ?? "",
          location: data.location ?? "",
          website: data.website ?? "",
        });
      }
      setLoading(false);
    })();
  }, [user]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
  }

  const initials = (form.full_name || user?.email || "?").slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="border-b border-border/60 bg-surface-muted/50">
          <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
            <h1 className="font-display text-3xl font-bold tracking-tight">Your profile</h1>
            <p className="mt-2 text-muted-foreground">Employers see this when you apply.</p>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <form onSubmit={save} className="rounded-2xl border border-border/70 bg-surface p-6 sm:p-8">
              <div className="flex items-center gap-5">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="bg-brand-gradient text-xl font-semibold text-primary-foreground">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-display text-lg font-semibold">{form.full_name || "Your name"}</div>
                  <div className="text-sm text-muted-foreground">{user?.email}</div>
                </div>
              </div>

              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="full_name">Full name</Label>
                  <Input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1.5" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="headline">Headline</Label>
                  <Input id="headline" placeholder="Senior Product Designer" value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} className="mt-1.5" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="website">Website / portfolio</Label>
                  <Input id="website" placeholder="https://" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="mt-1.5" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="bio">About</Label>
                  <Textarea id="bio" rows={5} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="mt-1.5" />
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
              </div>
            </form>
          )}
          <PromotionCodeSection />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

type RefStatus = { applied: boolean; code: string | null; applied_at: string | null; bonus_awarded_at: string | null; bonus_amount_cents: number };

function PromotionCodeSection() {
  const [status, setStatus] = useState<RefStatus | null>(null);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.rpc("get_my_referral_status" as never);
    const arr = ((data ?? []) as unknown) as RefStatus[];
    setStatus(arr[0] ?? { applied: false, code: null, applied_at: null, bonus_awarded_at: null, bonus_amount_cents: 0 });
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setSaving(true);
    const { error } = await supabase.rpc("apply_referral_code" as never, { _code: code.trim().toUpperCase() } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Referral code applied");
    setCode("");
    load();
  }

  if (loading) return null;
  return (
    <div className="mt-8 rounded-2xl border border-border/70 bg-surface p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-gradient text-primary-foreground"><Gift className="h-5 w-5" /></div>
        <div>
          <h2 className="font-display text-lg font-semibold">Promotion code</h2>
          <p className="text-sm text-muted-foreground">Apply a referral code from a Zurify partner. You can only apply one code, and it's locked once accepted.</p>
        </div>
      </div>
      {status?.applied ? (
        <div className="mt-5 space-y-3 rounded-lg border border-border/70 bg-surface-muted/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Applied code</p>
              <p className="mt-1 font-mono text-lg font-semibold">{status.code}</p>
            </div>
            {status.bonus_awarded_at ? (
              <Badge className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Bonus awarded {usd(status.bonus_amount_cents)}</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1"><Clock className="h-3.5 w-3.5" /> Pending first approved task</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Applied on {shortDate(status.applied_at)} · Locked</p>
        </div>
      ) : (
        <form onSubmit={apply} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="promo">Enter referral code</Label>
            <Input id="promo" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. JOHN2026" className="mt-1.5 font-mono uppercase" />
          </div>
          <Button type="submit" disabled={saving || !code.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply code
          </Button>
        </form>
      )}
    </div>
  );
}
