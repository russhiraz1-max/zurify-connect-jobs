/**
 * Single source of truth for the public origin.
 *
 * Order of resolution:
 *  1. VITE_SITE_URL — set this when moving to a custom domain (e.g. https://zurify.app).
 *  2. window.location.origin — correct automatically in the browser on any domain.
 *  3. FALLBACK_ORIGIN — only used during SSR/prerender when no env var is set.
 *
 * No page should hardcode a domain; import from here instead.
 */
const FALLBACK_ORIGIN = "https://zurify-connect-jobs.lovable.app";

export const SITE_NAME = "Zurify";
export const SITE_TAGLINE = "Complete jobs. Get paid.";
export const SITE_DESCRIPTION =
  "Earn real money completing micro tasks, gigs, freelance projects and remote work. Fast payouts via PayPal.";

export function siteOrigin(): string {
  const configured = import.meta.env["VITE_SITE_URL"] as string | undefined;
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return FALLBACK_ORIGIN;
}

export function siteUrl(path = "/"): string {
  return `${siteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Absolute origin for a server request — always accurate, whatever the domain. */
export function originFromRequest(request: Request): string {
  const configured = import.meta.env["VITE_SITE_URL"] as string | undefined;
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(request.url).origin;
}
