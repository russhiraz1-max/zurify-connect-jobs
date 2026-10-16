import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Gift, CheckCircle2, Clock, Wallet as WalletIcon, User as UserIcon, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { useRoles } from "@/lib/roles";
import { shortDate, usd } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Account — Zurify" }] }),
  component: ProfilePage,
});

type ProfileRow = {
  id: string; full_name: string | null; headline: string | null; bio: string | null;
  location: string | null; website: string | null; suspended: boolean; withdrawal_hold: boolean;
  created_at: string;
};
type WalletRow = {
  available_cents: number; pending_withdrawal_cents: number;
  lifetime_earned_cents: number; lifetime_withdrawn_cents: number;
};

function ProfilePage() {
  const { user } = useSession();
  const { isSuperAdmin, isStaff, roles } = useRoles();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [form, setForm] = useState({ full_name: "", headline: "", bio: "", location: "", website: "" });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [p, w] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("wallets").select("available_cents,pending_withdrawal_cents,lifetime_earned_cents,lifetime_withdrawn_cents").eq("user_id", user.id).maybeSingle(),
      ]);
      if (p.data) {
        setProfile(p.data as ProfileRow);
        setForm({
          full_name: p.data.full_name ?? "",
          headline: p.data.headline ?? "",
          bio: p.data.bio ?? "",
          location: p.data.location ?? "",
          website: p.data.website ?? "",
        });
      }
      if (w.data) setWallet(w.data as WalletRow);
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
  const roleLabel = isSuperAdmin ? "Super Admin" : isStaff ? "Staff" : roles.includes("employer") ? "Client" : roles.includes("job_seeker") ? "Freelancer" : "Member";
  const accountStatus = profile?.suspended ? { label: "Suspended", variant: "destructive" as const }
    : profile?.withdrawal_hold ? { label: "Withdrawals on hold", variant: "secondary" as const }
    : { label: "Active", variant: "default" as const };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="border-b border-border/60 bg-surface-muted/50">
          <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
            <h1 className="font-display text-3xl font-bold tracking-tight">Your account</h1>
            <p className="mt-2 text-muted-foreground">Manage your profile, wallet snapshot and referral link.</p>
          </div>
        </div>

        <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              {/* Account information */}
              <Card>
                <CardContent className="p-6 sm:p-8">
                  <SectionHeader icon={<UserIcon className="h-5 w-5" />} title="Account information" subtitle="Basic details visible to admins and reviewers." />
                  <div className="mt-6 flex items-center gap-5">
                    <Avatar className="h-20 w-20">
                      <AvatarFallback className="bg-brand-gradient text-xl font-semibold text-primary-foreground">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-display text-lg font-semibold">{form.full_name || "Your name"}</div>
                      <div className="text-sm text-muted-foreground">{user?.email}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline">{roleLabel}</Badge>
                        <Badge variant={accountStatus.variant}>{accountStatus.label}</Badge>
                        {profile?.created_at && <span className="text-muted-foreground">Joined {shortDate(profile.created_at)}</span>}
                      </div>
                    </div>
                  </div>

                  <form onSubmit={save} className="mt-8 grid gap-5 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="full_name">Username / Full name</Label>
                      <Input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1.5" />
                    </div>
                    <div>
                      <Label htmlFor="location">Location</Label>
                      <Input id="location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1.5" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="headline">Headline</Label>
                      <Input id="headline" placeholder="What best describes you?" value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} className="mt-1.5" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="website">Website / portfolio</Label>
                      <Input id="website" placeholder="https://" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="mt-1.5" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="bio">About</Label>
                      <Textarea id="bio" rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="mt-1.5" />
                    </div>
                    <div className="sm:col-span-2 flex justify-end">
                      <Button type="submit" disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save changes
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Wallet summary */}
              <Card>
                <CardContent className="p-6 sm:p-8">
                  <SectionHeader icon={<WalletIcon className="h-5 w-5" />} title="Wallet summary" subtitle="A snapshot of your earnings and payouts." />
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat label="Available" value={usd(wallet?.available_cents)} />
                    <Stat label="Pending withdrawal" value={usd(wallet?.pending_withdrawal_cents)} />
                    <Stat label="Lifetime earned" value={usd(wallet?.lifetime_earned_cents)} />
                    <Stat label="Lifetime withdrawn" value={usd(wallet?.lifetime_withdrawn_cents)} />
                  </div>
                </CardContent>
              </Card>

              {/* Promotion code */}
              <PromotionCodeSection />
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-primary-foreground">{icon}</div>
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-surface-muted/40 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
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
    if (!confirm("You may only enter ONE referral code for the lifetime of your account. Continue?")) return;
    setSaving(true);
    const { error } = await supabase.rpc("apply_referral_code" as never, { _code: code.trim().toUpperCase() } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Referral code applied — permanently locked to your account.");
    setCode("");
    load();
  }

  if (loading) return null;
  return (
    <Card>
      <CardContent className="p-6 sm:p-8">
        <SectionHeader icon={<Gift className="h-5 w-5" />} title="Promotion code" subtitle="Apply a referral code from a Zurify partner." />
        {status?.applied ? (
          <div className="mt-6 space-y-3 rounded-lg border border-border/70 bg-surface-muted/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
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
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Applied on {shortDate(status.applied_at)} · Permanently locked
            </p>
          </div>
        ) : (
          <form onSubmit={apply} className="mt-6 space-y-3">
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
              You may only enter <strong>one</strong> referral code for the lifetime of your account. Once submitted the field is permanently locked, even if the code is incorrect.
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor="promo">Enter referral code</Label>
                <Input id="promo" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. JOHN2026" className="mt-1.5 font-mono uppercase" />
              </div>
              <Button type="submit" disabled={saving || !code.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Apply code
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
