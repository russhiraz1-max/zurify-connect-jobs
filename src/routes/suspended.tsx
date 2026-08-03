import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldAlert, LifeBuoy, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { useAccountStatus } from "@/lib/account-status";
import { dateTime } from "@/lib/format";

export const Route = createFileRoute("/suspended")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Account suspended — Zurify" },
      { name: "description", content: "Your Zurify account has been suspended. Review the reason and submit an appeal." },
    ],
  }),
  component: SuspendedPage,
});

function SuspendedPage() {
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useSession();
  const { status, loading } = useAccountStatus();
  const [appeal, setAppeal] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) { navigate({ to: "/auth", replace: true }); return; }
    if (!loading && status && !status.suspended) navigate({ to: "/dashboard", replace: true });
  }, [user, sessionLoading, status, loading, navigate]);

  async function submitAppeal() {
    if (!user || !appeal.trim()) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .insert({ user_id: user.id, subject: "Suspension appeal" })
      .select("id")
      .single();
    if (error || !data) { setBusy(false); return toast.error(error?.message ?? "Could not submit appeal"); }
    const { error: msgError } = await supabase
      .from("support_ticket_messages")
      .insert({ ticket_id: data.id, author_id: user.id, body: appeal.trim() });
    setBusy(false);
    if (msgError) return toast.error(msgError.message);
    setAppeal("");
    setSent(true);
    toast.success("Appeal submitted. Our team will review it.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-bold sm:text-2xl">Account suspended</h1>
              <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading account status…
            </div>
          ) : (
            <dl className="mt-6 space-y-3 rounded-lg border border-border bg-background p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd><Badge variant="destructive">Suspended</Badge></dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Suspended on</dt>
                <dd className="text-right font-medium">{status?.suspended_at ? dateTime(status.suspended_at) : "—"}</dd>
              </div>
              <div className="gap-3">
                <dt className="text-muted-foreground">Reason</dt>
                <dd className="mt-1 whitespace-pre-line font-medium">
                  {status?.suspension_reason ?? "No reason was provided by the administrator."}
                </dd>
              </div>
            </dl>
          )}

          <p className="mt-6 text-sm text-muted-foreground">
            While suspended you cannot access tasks, your wallet, withdrawals or any other part of the platform.
            Your balance, history and records remain intact and are restored the moment the suspension is lifted.
          </p>

          <div className="mt-6 space-y-2">
            <Label htmlFor="appeal" className="flex items-center gap-2">
              <LifeBuoy className="h-4 w-4" /> Submit an appeal
            </Label>
            <Textarea
              id="appeal"
              rows={4}
              placeholder="Explain why you believe this suspension should be reviewed…"
              value={appeal}
              onChange={(e) => setAppeal(e.target.value)}
            />
            {sent && <p className="text-xs text-emerald-600">Your appeal was received. Support will reply by email.</p>}
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button onClick={submitAppeal} disabled={busy || !appeal.trim()} className="w-full sm:w-auto">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit appeal
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <a href="mailto:support@zurify.com">Contact support</a>
            </Button>
            <Button variant="ghost" onClick={signOut} className="w-full sm:ml-auto sm:w-auto">
              <LogOut className="mr-2 h-4 w-4" /> Log out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
