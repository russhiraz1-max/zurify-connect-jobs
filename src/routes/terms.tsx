import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms of Service — Zurify" }, { name: "description", content: "The rules for using Zurify." }] }),
  component: () => (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
        <h1 className="font-display text-4xl font-bold">Terms of Service</h1>
        <div className="prose prose-slate mt-8 max-w-none text-foreground">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          <h2>Eligibility</h2><p>You must be at least 18 and legally able to enter contracts.</p>
          <h2>Fair use</h2><p>No fake accounts, no automation, no fraudulent proof. Violations forfeit balances and end access.</p>
          <h2>Payments</h2><p>Rewards are paid only for submissions approved by our review team. A 10% service fee applies per $3 withdrawn.</p>
          <h2>Termination</h2><p>We may suspend accounts that violate these terms or platform integrity.</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  ),
});
