import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy — Zurify" }, { name: "description", content: "How Zurify collects, uses, and protects your data." }] }),
  component: () => <LegalPage title="Privacy Policy">
    <p>Last updated: {new Date().toLocaleDateString()}</p>
    <h2>What we collect</h2>
    <p>Your email, profile details you provide, task submissions, wallet activity, and audit metadata (IP, timestamps).</p>
    <h2>How we use it</h2>
    <p>To operate the platform, verify submissions, process withdrawals, and prevent fraud.</p>
    <h2>Sharing</h2>
    <p>We do not sell your data. Aggregated, non-identifying performance data may be shared with advertisers.</p>
    <h2>Your rights</h2>
    <p>You can request export or deletion of your data at any time via the Support Center.</p>
  </LegalPage>,
});

function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
        <h1 className="font-display text-4xl font-bold">{title}</h1>
        <div className="prose prose-slate mt-8 max-w-none text-foreground">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
