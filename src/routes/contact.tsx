import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [
    { title: "Contact Zurify" },
    { name: "description", content: "Get in touch with the Zurify team for advertiser partnerships or platform inquiries." },
    { property: "og:title", content: "Contact Zurify" },
    { property: "og:description", content: "Reach the Zurify team." },
  ] }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6">
        <h1 className="font-display text-4xl font-bold">Contact us</h1>
        <p className="mt-4 text-muted-foreground">
          For account or task help, use the Support Center after signing in. For advertiser partnerships or press,
          email the team directly.
        </p>
        <div className="mt-8 flex items-center gap-3 rounded-lg border border-border p-4">
          <Mail className="h-5 w-5 text-primary" />
          <a href="mailto:hello@zurify.app" className="font-medium">hello@zurify.app</a>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
