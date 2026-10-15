import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Settings — Admin" }] }),
  component: AdminSettings,
});

type PlatformConfig = {
  theme_palette: "blue-sky-violet" | "blue-sky-indigo" | "blue-sky-cyan";
  payment_provider: "disabled" | "flutterwave" | "paystack";
  payments_enabled: false;
  maintenance_mode: boolean;
  feature_flags: Record<string, boolean>;
  updated_at: string;
};

type Settings = {
  site_name: string; super_admin_email: string | null; staff_bootstrap_email: string | null;
  min_withdrawal_cents: number; withdrawal_unit_cents: number; fee_bps_per_unit: number;
  paypal_instructions: string | null;
  referral_enabled: boolean; referral_welcome_bonus_cents: number; referral_commission_bps: number;
  referral_min_withdrawal_cents: number; referral_code_length: number; referral_allowed_chars: string;
  referral_default_max_uses: number | null; referral_unlimited_uses: boolean;
};

function AdminSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    supabase.from("application_settings").select("*").eq("singleton", true).maybeSingle()
      .then(({ data }) => setS(data as Settings | null));
    void supabase.rpc("get_admin_platform_configuration" as never).then(({ data, error }) => {
      if (error) {
        toast.error(`Could not load locked platform configuration: ${error.message}`);
        return;
      }
      if (data) setPlatformConfig(data as unknown as PlatformConfig);
    });
  }, []);

  async function save() {
    if (!s) return;
    const { error } = await supabase.from("application_settings").update(s as never).eq("singleton", true);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  }

  async function savePlatformConfig() {
    if (!platformConfig) return;
    setSavingConfig(true);
    const { error } = await supabase.rpc("update_platform_configuration" as never, {
      _theme_palette: platformConfig.theme_palette,
      _payment_provider: platformConfig.payment_provider,
      _maintenance_mode: platformConfig.maintenance_mode,
      _feature_flags: platformConfig.feature_flags,
    } as never);
    setSavingConfig(false);
    if (error) return toast.error(error.message);
    toast.success("Locked platform configuration saved.");
    const { data, error: reloadError } = await supabase.rpc("get_admin_platform_configuration" as never);
    if (reloadError) toast.error(reloadError.message);
    else if (data) setPlatformConfig(data as unknown as PlatformConfig);
  }

  if (!s) return <AdminShell title="Settings"><Card><CardContent className="p-6">Loading…</CardContent></Card></AdminShell>;
  const set = (k: keyof Settings, v: unknown) => setS({ ...s, [k]: v } as Settings);

  return (
    <AdminShell title="Platform settings">
      <Card className="max-w-2xl">
        <CardContent className="space-y-4 p-6">
          <div><Label>Site name</Label><Input value={s.site_name ?? ""} onChange={e => set("site_name", e.target.value)} /></div>
          <div><Label>Super admin email</Label><Input value={s.super_admin_email ?? ""} onChange={e => set("super_admin_email", e.target.value)} /></div>
          <div><Label>Staff bootstrap email</Label><Input value={s.staff_bootstrap_email ?? ""} onChange={e => set("staff_bootstrap_email", e.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><Label>Min withdrawal (cents)</Label><Input type="number" value={s.min_withdrawal_cents} onChange={e => set("min_withdrawal_cents", parseInt(e.target.value || "0"))} /></div>
            <div><Label>Withdrawal unit (cents)</Label><Input type="number" value={s.withdrawal_unit_cents} onChange={e => set("withdrawal_unit_cents", parseInt(e.target.value || "0"))} /></div>
            <div><Label>Fee bps per unit</Label><Input type="number" value={s.fee_bps_per_unit} onChange={e => set("fee_bps_per_unit", parseInt(e.target.value || "0"))} /></div>
          </div>
          <div><Label>PayPal instructions</Label><Textarea rows={3} value={s.paypal_instructions ?? ""} onChange={e => set("paypal_instructions", e.target.value)} /></div>
          <Button onClick={save}>Save settings</Button>
        </CardContent>
      </Card>


      <Card className="mt-6 max-w-3xl border-primary/20">
        <CardContent className="space-y-5 p-6">
          <div>
            <h2 className="font-display text-lg font-semibold">Zurify 2.0 control center</h2>
            <p className="mt-1 text-sm text-muted-foreground">This configuration is enforced by a super-admin-only database RPC. It contains no API keys or payment secrets.</p>
          </div>
          {!platformConfig ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Loading configuration or access denied. Only a super admin can read or change these settings.</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="theme-palette">Theme palette</Label>
                  <select id="theme-palette" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={platformConfig.theme_palette} onChange={e => setPlatformConfig({ ...platformConfig, theme_palette: e.target.value as PlatformConfig["theme_palette"] })}>
                    <option value="blue-sky-violet">Blue · Sky blue · Violet</option>
                    <option value="blue-sky-indigo">Blue · Sky blue · Indigo</option>
                    <option value="blue-sky-cyan">Blue · Sky blue · Cyan</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="payment-provider">Preferred payment provider (not activated)</Label>
                  <select id="payment-provider" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={platformConfig.payment_provider} onChange={e => setPlatformConfig({ ...platformConfig, payment_provider: e.target.value as PlatformConfig["payment_provider"] })}>
                    <option value="disabled">Disabled</option>
                    <option value="flutterwave">Flutterwave (preferred)</option>
                    <option value="paystack">Paystack (future option)</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <span><span className="block text-sm font-medium">Maintenance mode</span><span className="mt-1 block text-xs text-muted-foreground">Stores the platform maintenance setting. Public-route enforcement must be implemented before using this to block traffic.</span></span>
                <input type="checkbox" checked={platformConfig.maintenance_mode} onChange={e => setPlatformConfig({ ...platformConfig, maintenance_mode: e.target.checked })} className="h-5 w-5" />
              </label>
              <div>
                <h3 className="text-sm font-semibold">Feature flags</h3>
                <p className="mb-3 mt-1 text-xs text-muted-foreground">Turning a flag off in this control center does not replace database authorization. Sensitive features remain disabled in server-side workflows until their implementation is complete.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    ["client_drafts", "Client draft workspace"],
                    ["ai_company_workspace", "AI-company workspace"],
                    ["client_funding", "Client funding (not implemented)"],
                    ["live_payments", "Live payments (hard-disabled)"],
                    ["dataset_exports", "Dataset exports (not implemented)"],
                    ["promo_codes", "Promo codes (not implemented)"],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                      <input type="checkbox" checked={Boolean(platformConfig.feature_flags[key])} disabled={["client_funding", "live_payments", "dataset_exports", "promo_codes"].includes(key)} onChange={e => setPlatformConfig({ ...platformConfig, feature_flags: { ...platformConfig.feature_flags, [key]: e.target.checked } })} className="h-4 w-4" />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-muted-foreground">
                <strong className="text-foreground">Safety lock:</strong> payment activation is forced to false in the database. Choosing Flutterwave or Paystack only records the preferred provider; it cannot move money. Add sandbox checkout, signed webhooks, server-side verification and reconciliation before enabling transactions.
              </div>
              <Button onClick={() => void savePlatformConfig()} disabled={savingConfig}>{savingConfig ? "Saving…" : "Save control-center settings"}</Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 max-w-2xl">
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="font-display text-lg font-semibold">Referral settings</h2>
            <p className="text-sm text-muted-foreground">Control the referral & affiliate program.</p>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div><Label>Referral system enabled</Label><p className="text-xs text-muted-foreground">Turn the entire referral program on or off.</p></div>
            <input type="checkbox" checked={s.referral_enabled} onChange={e => set("referral_enabled", e.target.checked)} className="h-5 w-5" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Welcome bonus (cents)</Label><Input type="number" value={s.referral_welcome_bonus_cents} onChange={e => set("referral_welcome_bonus_cents", parseInt(e.target.value || "0"))} /></div>
            <div><Label>Commission (bps, 1000 = 10%)</Label><Input type="number" value={s.referral_commission_bps} onChange={e => set("referral_commission_bps", parseInt(e.target.value || "0"))} /></div>
            <div><Label>Min withdrawal for commission (cents)</Label><Input type="number" value={s.referral_min_withdrawal_cents} onChange={e => set("referral_min_withdrawal_cents", parseInt(e.target.value || "0"))} /></div>
            <div><Label>Default code length</Label><Input type="number" value={s.referral_code_length} onChange={e => set("referral_code_length", parseInt(e.target.value || "0"))} /></div>
            <div className="sm:col-span-2"><Label>Allowed characters</Label><Input value={s.referral_allowed_chars} onChange={e => set("referral_allowed_chars", e.target.value)} /></div>
            <div><Label>Default max uses (blank = unlimited)</Label><Input type="number" value={s.referral_default_max_uses ?? ""} onChange={e => set("referral_default_max_uses", e.target.value ? parseInt(e.target.value) : null)} /></div>
            <div className="flex items-center gap-2 pt-6">
              <input id="unlim" type="checkbox" checked={s.referral_unlimited_uses} onChange={e => set("referral_unlimited_uses", e.target.checked)} className="h-4 w-4" />
              <Label htmlFor="unlim" className="cursor-pointer">Unlimited uses by default</Label>
            </div>
          </div>
          <Button onClick={save}>Save referral settings</Button>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
