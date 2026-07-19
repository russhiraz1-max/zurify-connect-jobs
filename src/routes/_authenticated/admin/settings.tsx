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

type Settings = {
  site_name: string; super_admin_email: string | null; staff_bootstrap_email: string | null;
  min_withdrawal_cents: number; withdrawal_unit_cents: number; fee_bps_per_unit: number;
  paypal_instructions: string | null;
};

function AdminSettings() {
  const [s, setS] = useState<Settings | null>(null);

  useEffect(() => {
    supabase.from("application_settings").select("*").eq("singleton", true).maybeSingle()
      .then(({ data }) => setS(data as Settings | null));
  }, []);

  async function save() {
    if (!s) return;
    const { error } = await supabase.from("application_settings").update(s as never).eq("singleton", true);
    if (error) return toast.error(error.message);
    toast.success("Saved");
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
    </AdminShell>
  );
}
