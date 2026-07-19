import { Link } from "@tanstack/react-router";
import { Briefcase } from "lucide-react";

const links = [
  { to: "/about", label: "About" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
  { to: "/support", label: "Support" },
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/terms", label: "Terms of Service" },
  { to: "/cookies", label: "Cookie Policy" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-surface-muted/40">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-primary-foreground">
                <Briefcase className="h-3.5 w-3.5" />
              </span>
              <span className="font-display text-sm font-bold">Zurify</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Complete simple tasks. Get paid in real USD via PayPal.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
            {links.map(l => (
              <Link key={l.to} to={l.to} className="text-sm text-muted-foreground hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-8 flex flex-col items-start justify-between gap-2 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Zurify. All rights reserved.</p>
          <p>Built by RShiraz.</p>
        </div>
      </div>
    </footer>
  );
}
