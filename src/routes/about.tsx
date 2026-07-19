import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [
    { title: "About Zurify" },
    { name: "description", content: "Zurify is a managed task earning platform. Complete simple tasks reviewed by our team and get paid in real USD." },
    { property: "og:title", content: "About Zurify" },
    { property: "og:description", content: "Zurify is a managed task earning platform." },
  ] }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
        <h1 className="font-display text-4xl font-bold">About Zurify</h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Zurify is a managed task earning platform. Advertisers bring campaigns to our team, our
          administrators curate and publish tasks, and users earn real USD for completing them.
        </p>
        <div className="prose prose-slate mt-8 max-w-none text-foreground">
          <h2>Why Zurify</h2>
          <p>Every task is manually reviewed by our staff. That keeps quality high for advertisers and rewards fair for users.</p>
          <h2>How we pay</h2>
          <p>Approved submissions credit your wallet automatically. Withdraw to PayPal any time your balance reaches $3.</p>
          <h2>Who we serve</h2>
          <p>Users looking to earn from short online tasks, and advertisers who want reliable, human-reviewed engagement.</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
