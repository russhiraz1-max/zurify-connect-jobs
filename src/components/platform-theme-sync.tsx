import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const allowedPalettes = new Set(["blue-sky-violet", "blue-sky-indigo", "blue-sky-cyan"]);

export function PlatformThemeSync() {
  useEffect(() => {
    let active = true;
    void supabase.rpc("get_public_platform_configuration" as never).then(({ data }) => {
      if (!active || !data || typeof data !== "object") return;
      const palette = (data as { theme_palette?: unknown }).theme_palette;
      if (typeof palette === "string" && allowedPalettes.has(palette)) {
        document.documentElement.dataset.themePalette = palette;
      }
    });
    return () => { active = false; };
  }, []);

  return null;
}
