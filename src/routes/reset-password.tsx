import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Briefcase, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset your password — Zurify" },
      { name: "description", content: "Choose a new password for your Zurify account." },
    ],
  }),
  component: ResetPasswordPage,
});

type Phase = "checking" | "ready" | "invalid" | "done";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const recoveryEventSeen = useRef(false);

  useEffect(() => {
    let active = true;
    // Supabase delivers a recovery session from the emailed link. It may land
    // either already exchanged, or via the PASSWORD_RECOVERY event.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && active) {
        recoveryEventSeen.current = true;
        setPhase("ready");
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      // The recovery event and initial session lookup can resolve in either
      // order. Do not let a stale empty-session result overwrite a valid event.
      setPhase(data.session || recoveryEventSeen.current ? "ready" : "invalid");
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return toast.error("Use at least one letter and one number.");
    }
    if (password !== confirm) return toast.error("Passwords do not match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPhase("done");
    toast.success("Password updated. Please sign in.");
    await supabase.auth.signOut();
    setTimeout(() => navigate({ to: "/auth", replace: true }), 1200);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient text-primary-foreground">
            <Briefcase className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-bold">Zurify</span>
        </Link>
        <Card>
          <CardContent className="p-6 sm:p-8">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <h1 className="font-display text-xl font-bold">Reset your password</h1>
            </div>

            {phase === "checking" && (
              <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Verifying your recovery link…
              </p>
            )}

            {phase === "invalid" && (
              <div className="mt-6 space-y-4">
                <p className="text-sm text-muted-foreground">
                  This recovery link is invalid or has expired. Request a new one from the sign-in page.
                </p>
                <Button asChild className="w-full"><Link to="/auth">Back to sign in</Link></Button>
              </div>
            )}

            {phase === "done" && (
              <div className="mt-6 space-y-4">
                <p className="text-sm text-emerald-600">Your password was updated successfully.</p>
                <Button asChild className="w-full"><Link to="/auth">Continue to sign in</Link></Button>
              </div>
            )}

            {phase === "ready" && (
              <form onSubmit={submit} className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="newpw">New password</Label>
                  <Input id="newpw" type="password" required minLength={8} value={password}
                    onChange={(e) => setPassword(e.target.value)} className="mt-1.5" />
                  <p className="mt-1 text-xs text-muted-foreground">At least 8 characters, including a letter and a number.</p>
                </div>
                <div>
                  <Label htmlFor="confirmpw">Confirm password</Label>
                  <Input id="confirmpw" type="password" required minLength={8} value={confirm}
                    onChange={(e) => setConfirm(e.target.value)} className="mt-1.5" />
                </div>
                <Button type="submit" className="h-11 w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update password
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
