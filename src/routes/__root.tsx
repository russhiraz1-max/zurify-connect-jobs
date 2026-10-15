import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { AccountRealtime } from "@/components/account-realtime";
import { ThemeProvider } from "@/lib/theme";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. Try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Zurify — Complete tasks. Get paid." },
      { name: "description", content: "Earn real money completing simple online tasks. Fast payouts via PayPal. Join Zurify today." },
      { name: "author", content: "Zurify" },
      { name: "theme-color", content: "#1d4ed8" },
      { name: "apple-mobile-web-app-title", content: "Zurify" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "application-name", content: "Zurify" },

      { property: "og:title", content: "Zurify — Complete tasks. Get paid." },
      { property: "og:description", content: "Earn real money completing simple online tasks. Fast payouts via PayPal. Join Zurify today." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Zurify — Complete tasks. Get paid." },
      { name: "twitter:description", content: "Earn real money completing simple online tasks. Fast payouts via PayPal. Join Zurify today." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/04ced3cb-fcd0-49bd-8699-62257954dadd" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/04ced3cb-fcd0-49bd-8699-62257954dadd" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],

  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const redirectIfOnEntryPage = (userId: string | undefined) => {
      if (!active || !userId || typeof window === "undefined") return;
      const path = window.location.pathname;
      if (path !== "/" && path !== "/auth") return;

      // Defer the table lookup until the auth-state callback has returned. This
      // avoids calling Supabase auth methods inside its auth lock callback.
      void Promise.resolve().then(async () => {
        const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
        if (!active) return;
        const roles = (roleRows ?? []).map((row) => row.role);
        const isClient = roles.includes("employer");
        const isAiCompany = roles.includes("ai_company");
        const isAdmin = roles.some((role) => ["super_admin", "staff", "admin"].includes(role));
        const hasAccountType = roles.includes("employer") || roles.includes("job_seeker") || roles.includes("ai_company");
        const hasPrivilegedOrSpecialRole = roles.some((role) =>
          ["super_admin", "staff", "admin", "advertiser"].includes(role),
        );
        const destination = !hasAccountType && !hasPrivilegedOrSpecialRole
          ? "/choose-account-type"
          : isAdmin
            ? "/admin"
            : isClient
              ? "/client-dashboard"
              : "/dashboard";
        void navigate({ to: destination as never, replace: true });
      });
    };

    // Check the persisted session once on mount.
    void supabase.auth.getSession().then(({ data }) => {
      redirectIfOnEntryPage(data.session?.user.id);
    });

    // Use the session passed by Supabase. Do not call Supabase auth methods
    // from inside this callback; doing so can deadlock its auth lock.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") {
        queryClient.invalidateQueries();
        if (event === "SIGNED_IN") redirectIfOnEntryPage(session?.user.id);
      }
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [router, queryClient, navigate]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AccountRealtime />
        <Outlet />
        <Toaster richColors position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );

}
