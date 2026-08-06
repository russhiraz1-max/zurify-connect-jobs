import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Zurify" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [newPass, setNewPass] = useState("");
  const [saving, setSaving] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [weekly, setWeekly] = useState(true);

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPass.length < 6) return toast.error("Password must be at least 6 characters");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setSaving(false);
    if (error) return toast.error(error.message);
    setNewPass("");
    toast.success("Password updated");
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="border-b border-border/60 bg-surface-muted/50">
          <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
            <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
            <p className="mt-2 text-muted-foreground">Manage your account, notifications, and security.</p>
          </div>
        </div>

        <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
          <Section title="Account" description="Your login email.">
            <div>
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled className="mt-1.5" />
            </div>
          </Section>

          <Section title="Appearance" description="Pick the look that suits you. Saved on this device.">
            <div className="grid gap-3 sm:grid-cols-3">
              {THEMES.map((t) => {
                const active = theme === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTheme(t.value)}
                    aria-pressed={active}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      active ? "border-primary bg-accent/50 ring-2 ring-ring" : "border-border/60 bg-background hover:bg-accent/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t.label}</span>
                      {active && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
                    <div className="mt-3 flex gap-1.5" aria-hidden>
                      {(t.value === "light"
                        ? ["#ffffff", "#eef2ff", "#2563eb"]
                        : t.value === "dark"
                          ? ["#111827", "#1f2937", "#60a5fa"]
                          : ["#16255c", "#22357a", "#5b93ff"]
                      ).map((c) => (
                        <span key={c} className="h-5 w-5 rounded-full border border-border" style={{ background: c }} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Notifications" description="Choose what Zurify emails you.">
            <ToggleRow label="Application updates" description="Status changes on jobs you've applied to." checked={emailAlerts} onChange={setEmailAlerts} />
            <ToggleRow label="Weekly job digest" description="A curated list of new roles every Monday." checked={weekly} onChange={setWeekly} />
          </Section>


          <Section title="Password" description="Change the password used for email sign-in.">
            <form onSubmit={updatePassword} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor="newpass">New password</Label>
                <Input id="newpass" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className="mt-1.5" />
              </div>
              <Button type="submit" disabled={saving || !newPass}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update
              </Button>
            </form>
          </Section>

          <Section title="Danger zone" description="Sign out of your Zurify account on this device.">
            <Button variant="destructive" onClick={signOut}>Sign out</Button>
          </Section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-background p-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
