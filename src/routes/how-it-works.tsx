import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Search, Send, CheckCircle2, Wallet } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({ meta: [
    { title: "How Zurify Works" },
    { name: "description", content: "Sign up, apply to tasks, submit proof, and get paid. See the exact workflow." },
    { property: "og:title", content: "How Zurify Works" },
    { property: "og:description", content: "Sign up, apply to tasks, submit proof, and get paid." },
  ] }),
  component: HowPage,
});

const steps = [
  { icon: UserPlus, title: "Create your account", body: "Sign up with email or Google. Verify your email to activate your wallet." },
  { icon: Search, title: "Browse tasks", body: "Filter by category and reward. See exactly what proof is required before you apply." },
  { icon: Send, title: "Apply to participate", body: "Every task starts with a quick application. Our team reviews and approves qualified users." },
  { icon: CheckCircle2, title: "Submit proof", body: "Once approved, complete the task and upload your proof. Admins review manually." },
  { icon: Wallet, title: "Get paid", body: "Approved submissions credit your wallet. Withdraw to PayPal from $3." },
];

function HowPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <h1 className="font-display text-4xl font-bold">How Zurify works</h1>
          <p className="mt-4 text-lg text-muted-foreground">Five simple steps from signup to your first payout.</p>
          <div className="mt-10 space-y-4">
            {steps.map((s, i) => (
              <Card key={s.title}>
                <CardContent className="flex items-start gap-4 p-6">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-gradient text-primary-foreground">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step {i + 1}</p>
                    <h3 className="mt-1 font-semibold">{s.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-10">
            <Button asChild size="lg"><Link to="/auth" search={{ mode: "signup" }}>Create your account</Link></Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
