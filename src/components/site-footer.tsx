import { Briefcase } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-surface-muted/50">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-10 sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-primary-foreground">
            <Briefcase className="h-3.5 w-3.5" />
          </span>
          <span className="font-display text-sm font-bold">Zurify</span>
          <span className="text-sm text-muted-foreground">— Careers, refined.</span>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Zurify, Inc. All rights reserved.</p>
      </div>
    </footer>
  );
}
