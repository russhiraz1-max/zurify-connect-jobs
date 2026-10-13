import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BriefcaseBusiness, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { useRoles } from "@/lib/roles";

export const Route = createFileRoute("/choose-account-type")({
  head: () => ({ meta: [{ title: "Choose your Zurify account — Zurify" }] }),
  component: ChooseAccountTypePage,
});

type AccountType = "job_seeker" | "employer";

function ChooseAccountTypePage() {
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useSession();
  const { roles, loading: rolesLoading } = useRoles();
  const [choice, setChoice] = useState<AccountType>("job_seeker");
  const [saving, setSaving] = useState(false);

  const hasAccountType = roles.includes("job_seeker") || roles.includes("employer");
  const hasSpecialRole = roles.some(role => ["super_admin", "staff", "admin", "advertiser"].includes(role));

  useEffect(() => {
    if (sessionLoading || rolesLoading) return;
    if (!user) {
      void navigate({ to: "/auth", replace: true });
      return;
    }
    if (hasAccountType || hasSpecialRole) {
      const isAdmin = roles.some(role => ["super_admin", "staff", "admin"].includes(role));
      void navigate({ to: isAdmin ? "/admin" : roles.includes("employer") ? "/client-dashboard" : "/dashboard", replace: true });
    }
  }, [user, sessionLoading, rolesLoading, hasAccountType, hasSpecialRole, roles, navigate]);

  async function completeOnboarding() {
    setSaving(true);
    const { error } = await supabase.rpc("complete_account_type" as never, {
      _account_type: choice,
    } as never);
    setSaving(false);
    if (error) {
      toast.error(error.message || "We couldn't save your account type. Please try again.");
      return;
    }
    toast.success("Your Zurify workspace is ready.");
    await navigate({ to: choice === "employer" ? "/client-dashboard" : "/dashboard", replace: true });
  }

  if (sessionLoading || rolesLoading || !user || hasAccountType || hasSpecialRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-workspace-glow px-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Preparing your workspace…
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-workspace-glow px-4 py-10">
      <Card className="w-full max-w-2xl overflow-hidden border-primary/15 shadow-lg">
        <CardHeader className="border-b border-border/60 bg-gradient-to-r from-primary/10 via-violet-500/10 to-sky-500/10 p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">One last step</p>
          <CardTitle className="mt-2 font-display text-2xl sm:text-3xl">How will you use Zurify?</CardTitle>
          <CardDescription className="max-w-xl text-sm leading-relaxed">
            Choose the workspace that fits you. You can start for free; payment and hiring actions will only be enabled when their secure workflows are ready.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-6 sm:p-8">
          <button
            type="button"
            onClick={() => setChoice("job_seeker")}
            aria-pressed={choice === "job_seeker"}
            className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all sm:p-5 ${choice === "job_seeker" ? "border-primary bg-primary/5 ring-2 ring-primary/15" : "border-border hover:bg-accent/40"}`}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300"><UserRound className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Find work</span>
              <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">Explore microtasks, freelance projects, gigs and remote opportunities. Track submissions and earnings in your freelancer dashboard.</span>
            </span>
            <span className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${choice === "job_seeker" ? "border-primary bg-primary ring-2 ring-primary/20 ring-offset-2 ring-offset-background" : "border-muted-foreground/40"}`} />
          </button>
          <button
            type="button"
            onClick={() => setChoice("employer")}
            aria-pressed={choice === "employer"}
            className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all sm:p-5 ${choice === "employer" ? "border-violet-500 bg-violet-500/5 ring-2 ring-violet-500/15" : "border-border hover:bg-accent/40"}`}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300"><BriefcaseBusiness className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Hire talent</span>
              <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">Prepare task drafts and organize work for contributors. Client funding, project publishing and billing will become available after the related secure flows are complete.</span>
            </span>
            <span className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${choice === "employer" ? "border-violet-500 bg-violet-500 ring-2 ring-violet-500/20 ring-offset-2 ring-offset-background" : "border-muted-foreground/40"}`} />
          </button>
          <Button className="h-11 w-full" onClick={() => void completeOnboarding()} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? "Setting up your workspace…" : "Continue to Zurify"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Need help? <Link to="/support" className="font-medium text-primary underline-offset-4 hover:underline">Contact support</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
