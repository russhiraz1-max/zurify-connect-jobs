import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { ArrowLeft, Briefcase, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  redirect: z.string().optional(),
  ref: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Zurify" },
      { name: "description", content: "Sign in or create a free Zurify account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const initialTab = search.mode === "signup" || search.ref ? "signup" : "signin";
  const navigate = useNavigate();
  // Only allow internal app paths; never accept protocol-relative or external redirects.
  const requestedRedirect = search.redirect ?? "/dashboard";
  const redirectTo = requestedRedirect.startsWith("/") && !requestedRedirect.startsWith("//")
    ? requestedRedirect
    : "/dashboard";

  const [tab, setTab] = useState<"signin" | "signup">(initialTab);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [referralCode, setReferralCode] = useState((search.ref ?? "").toUpperCase());
  const [accountType, setAccountType] = useState<"job_seeker" | "employer">("job_seeker");

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setLoading(false); return toast.error(error.message); }
    const { data: statusRows } = await supabase.rpc("get_my_account_status" as never);
    const suspended = (statusRows as { suspended: boolean }[] | null)?.[0]?.suspended;
    setLoading(false);
    if (suspended) {
      toast.error("This account is suspended.");
      navigate({ to: "/suspended", replace: true });
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: redirectTo as never, replace: true });
  }

  async function handleForgotPassword() {
    if (!email.trim()) return toast.error("Enter your email address first.");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setResetSent(true);
    toast.success("Password recovery email sent.");
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName, account_type: accountType },
      },
    });
    if (error) { setLoading(false); return toast.error(error.message); }
    // Apply referral code if user is immediately signed in (email confirmation disabled)
    if (referralCode.trim() && data.session) {
      const { error: refError } = await supabase.rpc("apply_referral_code" as never, { _code: referralCode.trim().toUpperCase() } as never);
      if (refError) toast.warning(`Referral code not applied: ${refError.message}. You can retry from your profile.`);
      else toast.success("Referral code applied!");
    }
    setLoading(false);
    if (!data.session) {
      toast.success("Account created. Check your email to confirm your address, then you will be redirected to your dashboard.");
      return;
    }
    toast.success("Account created!");
    navigate({ to: redirectTo as never, replace: true });
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/`,
    });
    if (result.error) {
      setGoogleLoading(false);
      toast.error(result.error.message ?? "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: redirectTo });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand-gradient p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-foreground/15">
            <Briefcase className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-bold">Zurify</span>
        </Link>
        <div>
          <h2 className="font-display text-4xl font-bold leading-tight">
            "Zurify made me realize I had options I didn't know existed."
          </h2>
          <p className="mt-6 text-primary-foreground/80">— Priya M., Product Designer @ Halcyon</p>
        </div>
        <div className="text-sm text-primary-foreground/70">Trusted by 2,400+ companies worldwide.</div>
      </div>

      <div className="flex flex-col px-6 py-10 sm:px-12">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-primary-foreground">
              <Briefcase className="h-3.5 w-3.5" />
            </span>
            <span className="font-display font-bold">Zurify</span>
          </Link>
        </div>

        <div className="mx-auto mt-16 w-full max-w-sm">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {tab === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {tab === "signin" ? "Sign in to continue to Zurify." : "Free forever. No credit card required."}
          </p>

          <Button
            type="button"
            variant="outline"
            className="mt-8 h-11 w-full"
            onClick={handleGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4-5.5 4-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.7 14.7 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12S6.9 21.2 12 21.2c6.9 0 9.2-4.8 9.2-7.3 0-.5-.1-.9-.1-1.3H12z"/>
              </svg>
            )}
            Continue with Google
          </Button>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button type="button" onClick={handleForgotPassword}
                      className="text-xs font-medium text-primary hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" />
                </div>
                <Button type="submit" className="h-11 w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
                {resetSent && (
                  <p className="text-xs text-emerald-600">
                    Recovery email sent. Check your inbox (and spam folder) for the reset link.
                  </p>
                )}
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1.5" />
                </div>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">What do you want to do on Zurify?</legend>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${accountType === "job_seeker" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                      <input
                        type="radio"
                        name="accountType"
                        value="job_seeker"
                        checked={accountType === "job_seeker"}
                        onChange={() => setAccountType("job_seeker")}
                        className="mt-1 accent-primary"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">Find work</span>
                        <span className="mt-1 block text-xs text-muted-foreground">Freelancer or task worker</span>
                      </span>
                    </label>
                    <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${accountType === "employer" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                      <input
                        type="radio"
                        name="accountType"
                        value="employer"
                        checked={accountType === "employer"}
                        onChange={() => setAccountType("employer")}
                        className="mt-1 accent-primary"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">Hire talent</span>
                        <span className="mt-1 block text-xs text-muted-foreground">Post work for a team</span>
                      </span>
                    </label>
                  </div>
                </fieldset>
                <div>
                  <Label htmlFor="email2">Email</Label>
                  <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="password2">Password</Label>
                  <Input id="password2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="ref">Referral code <span className="text-muted-foreground">(optional)</span></Label>
                  <Input id="ref" value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())} placeholder="e.g. JOHN2026" className="mt-1.5 font-mono uppercase" />
                  <p className="mt-1 text-xs text-muted-foreground">You may only enter one referral code for the lifetime of your account.</p>
                </div>
                <Button type="submit" className="h-11 w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            By continuing, you agree to Zurify's Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
