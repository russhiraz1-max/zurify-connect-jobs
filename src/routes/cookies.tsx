import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/cookies")({
  head: () => ({ meta: [{ title: "Cookie Policy — Zurify" }, { name: "description", content: "How Zurify uses cookies." }] }),
  component: () => (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
        <h1 className="font-display text-4xl font-bold">Cookie Policy</h1>
        <div className="prose prose-slate mt-8 max-w-none text-foreground">
          <p>We use only essential cookies to keep you signed in and to secure your session. We do not use marketing or third-party tracking cookies.</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  ),
});
