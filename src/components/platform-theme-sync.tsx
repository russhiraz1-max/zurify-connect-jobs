import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const allowedPalettes = new Set(["blue-sky-violet", "blue-sky-indigo", "blue-sky-cyan"]);

type PublicPlatformConfig = {
  theme_palette?: unknown;
  maintenance_mode?: unknown;
};

function applyPalette(data: PublicPlatformConfig) {
  if (typeof data.theme_palette === "string" && allowedPalettes.has(data.theme_palette)) {
    document.documentElement.dataset.themePalette = data.theme_palette;
  }
}

export function PlatformThemeSync() {
  const pathname = useRouterState({ select: state => state.location.pathname });
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  useEffect(() => {
    let active = true;
    const applyConfig = (data: unknown) => {
      if (!data || typeof data !== "object") return;
      const config = data as PublicPlatformConfig;
      applyPalette(config);
      if (typeof config.maintenance_mode === "boolean") setMaintenanceMode(config.maintenance_mode);
    };
    void supabase.rpc("get_public_platform_configuration" as never).then(({ data }) => {
      if (active) applyConfig(data);
    });
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<PublicPlatformConfig>).detail;
      if (active && detail) applyConfig(detail);
    };
    window.addEventListener("zurify:platform-config-updated", onUpdate);
    return () => {
      active = false;
      window.removeEventListener("zurify:platform-config-updated", onUpdate);
    };
  }, []);

  const maintenanceExempt = pathname.startsWith("/admin")
    || pathname === "/auth"
    || pathname === "/reset-password"
    || pathname === "/suspended";

  if (!maintenanceMode || maintenanceExempt) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="maintenance-title" className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-background/98 px-4 py-12 backdrop-blur">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 text-center shadow-2xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 via-violet-500/15 to-sky-500/20 text-primary">
          <span className="text-2xl font-bold">Z</span>
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-primary">Zurify maintenance</p>
        <h1 id="maintenance-title" className="mt-2 font-display text-2xl font-bold">We’ll be back shortly</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Zurify is temporarily unavailable while we make improvements. Your account and saved work are not being changed by this screen.</p>
        <Link to="/auth" className="mt-6 inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Staff sign-in</Link>
      </div>
    </div>
  );
}
