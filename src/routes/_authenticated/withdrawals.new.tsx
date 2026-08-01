import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { usd } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/withdrawals/new")({
  head: () => ({ meta: [{ title: "New withdrawal — Zurify" }] }),
  component: NewWithdrawalPage,
});

type KycStatus = "not_started" | "pending" | "approved" | "rejected";

function NewWithdrawalPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [amount, setAmount] = useState("3.00");
  const [email, setEmail] = useState("");
  const [available, setAvailable] = useState(0);
  const [settings, setSettings] = useState<{ min_withdrawal_cents: number; withdrawal_unit_cents: number; fee_bps_per_unit: number; paypal_instructions: string | null } | null>(null);
  const [kyc, setKyc] = useState<KycStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("wallets").select("available_cents").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setAvailable((data as { available_cents: number } | null)?.available_cents ?? 0));
    supabase.rpc("get_withdrawal_settings")
      .then(({ data }) => setSettings((Array.isArray(data) ? data[0] : data) as never));
    supabase.rpc("get_my_kyc" as never).then(({ data }) => {
      const arr = ((data ?? []) as unknown) as { status: KycStatus; paypal_email: string }[];
      setKyc(arr[0]?.status ?? "not_started");
      if (arr[0]?.status === "approved" && arr[0].paypal_email) setEmail(arr[0].paypal_email);
    });
  }, [user?.id]);


  const cents = Math.round(parseFloat(amount || "0") * 100);
  const unit = settings?.withdrawal_unit_cents ?? 300;
  const bps = settings?.fee_bps_per_unit ?? 1000;
  const min = settings?.min_withdrawal_cents ?? 300;
  const fee = isFinite(cents) && cents > 0 ? Math.floor(cents / unit) * unit * bps / 10000 : 0;
  const net = cents - fee;
  const validMultiple = cents > 0 && cents % unit === 0;
  const validMin = cents >= min;
  const validBalance = cents <= available;
  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const canSubmit = validMultiple && validMin && validBalance && validEmail && !busy;

  async function submit() {
    setBusy(true);
    const { error } = await supabase.rpc("request_withdrawal", {
      _amount_cents: cents, _method: "paypal", _destination: { paypal_email: email },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Withdrawal requested");
    navigate({ to: "/withdrawals" });
  }

  return (
    <AppShell title="Request withdrawal" subtitle={`Available balance: ${usd(available)}`}>
      <Card className="max-w-xl">
        <CardContent className="space-y-4 p-6">
          {settings?.paypal_instructions && (
            <Alert><AlertDescription className="text-xs">{settings.paypal_instructions}</AlertDescription></Alert>
          )}
          <div>
            <Label htmlFor="amount">Amount (USD)</Label>
            <Input id="amount" type="number" min="3" step="3" value={amount} onChange={e => setAmount(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Minimum {usd(min)}, in multiples of {usd(unit)}.</p>
          </div>
          <div>
            <Label htmlFor="pp">PayPal email</Label>
            <Input id="pp" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="rounded-lg border border-border p-4 text-sm">
            <div className="flex justify-between"><span>Requested</span><span>{usd(cents)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Service fee (10%)</span><span>−{usd(fee)}</span></div>
            <div className="mt-2 flex justify-between border-t pt-2 font-semibold"><span>You receive</span><span>{usd(net)}</span></div>
          </div>
          {!validMultiple && cents > 0 && <p className="text-xs text-destructive">Amount must be a multiple of {usd(unit)}.</p>}
          {!validMin && cents > 0 && <p className="text-xs text-destructive">Minimum is {usd(min)}.</p>}
          {!validBalance && cents > 0 && <p className="text-xs text-destructive">Exceeds available balance.</p>}
          <Button onClick={submit} disabled={!canSubmit} className="w-full">Request withdrawal</Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
