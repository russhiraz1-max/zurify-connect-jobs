import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  head: () => ({ meta: [
    { title: "FAQ — Zurify" },
    { name: "description", content: "Answers to common questions about earning, withdrawals, and task reviews on Zurify." },
    { property: "og:title", content: "FAQ — Zurify" },
    { property: "og:description", content: "Common questions about earning and withdrawals on Zurify." },
  ] }),
  component: FaqPage,
});

const faqs = [
  { q: "How do I get paid?", a: "Approved submissions credit your wallet immediately. Request a withdrawal to PayPal once your balance is at least $3." },
  { q: "Why do I have to apply first?", a: "Every task requires approval before you can submit. This keeps the platform trustworthy for advertisers and fair for other users." },
  { q: "How long does review take?", a: "Most submissions are reviewed within 24 hours. Withdrawals are paid within 48 hours of approval." },
  { q: "Is there a fee?", a: "A 10% service fee applies to every $3 unit withdrawn. You'll always see the exact fee and net amount before confirming." },
  { q: "What if my submission is rejected?", a: "You'll receive a notification with the reason. Some tasks allow re-submission — check the task page for details." },
  { q: "Can I create tasks?", a: "No. Only Zurify administrators publish tasks. Advertisers can partner with us through the Contact page." },
];

function FaqPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
        <h1 className="font-display text-4xl font-bold">Frequently asked questions</h1>
        <Accordion type="single" collapsible className="mt-8">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`q-${i}`}>
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </main>
      <SiteFooter />
    </div>
  );
}
