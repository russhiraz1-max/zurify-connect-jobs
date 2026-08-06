import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "blue";

export const THEMES: { value: Theme; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "Bright and neutral" },
  { value: "dark", label: "Dark", hint: "Easy on the eyes at night" },
  { value: "blue", label: "Zurify Blue", hint: "Deep brand navy" },
];

const STORAGE_KEY = "zurify:theme";

type Ctx = { theme: Theme; setTheme: (t: Theme) => void };
const ThemeContext = createContext<Ctx>({ theme: "light", setTheme: () => {} });

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("dark", "theme-blue");
  if (theme === "dark") root.classList.add("dark");
  if (theme === "blue") root.classList.add("theme-blue");
  root.dataset["theme"] = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start at the SSR default and reconcile after hydration so markup matches.
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    let stored: Theme | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    } catch {
      stored = null;
    }
    const next: Theme = stored === "dark" || stored === "blue" || stored === "light" ? stored : "light";
    setThemeState(next);
    applyTheme(next);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
