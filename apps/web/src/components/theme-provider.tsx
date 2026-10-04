"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "system" | "light" | "dark";
type ThemeContextValue = { theme: Theme; resolvedTheme: "light" | "dark"; setTheme: (theme: Theme) => void; cycleTheme: () => void };

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => setSystemTheme(media.matches ? "dark" : "light");
    // Seed browser appearance preferences after the stable server render.
    syncSystemTheme();

    const saved = window.localStorage.getItem("loresync-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "light" || saved === "dark") setTheme(saved);

    try {
      const profile = JSON.parse(window.localStorage.getItem("loresync-profile-v1") ?? "null");
      const accents: Record<string, [string, string]> = {
        signal: ["#ed1c24", "#f4d7d4"], blue: ["#4566c8", "#dce4f8"],
        moss: ["#5b7450", "#dfe9d7"], amber: ["#b8782b", "#f1e3cf"], plum: ["#89577f", "#eddfeb"],
      };
      const selectedAccent = accents[profile?.accent];
      if (selectedAccent) {
        document.documentElement.style.setProperty("--accent", selectedAccent[0]);
        document.documentElement.style.setProperty("--accent-soft", selectedAccent[1]);
        document.documentElement.style.setProperty("--tomato", selectedAccent[0]);
        document.documentElement.style.setProperty("--tomato-dark", selectedAccent[0]);
        document.documentElement.style.setProperty("--citron", selectedAccent[0]);
      }
      if (["roomy", "balanced", "compact"].includes(profile?.density)) document.documentElement.dataset.density = profile.density;
      if (["small", "standard", "large"].includes(profile?.typeScale)) document.documentElement.dataset.typeScale = profile.typeScale;
      if (typeof profile?.reducedMotion === "boolean") document.documentElement.dataset.motion = profile.reducedMotion ? "reduced" : "full";
    } catch { /* Use default appearance when stored profile settings cannot be read. */ }

    media.addEventListener("change", syncSystemTheme);
    return () => media.removeEventListener("change", syncSystemTheme);
  }, []);

  useEffect(() => {
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
      window.localStorage.removeItem("loresync-theme");
    } else {
      document.documentElement.dataset.theme = theme;
      window.localStorage.setItem("loresync-theme", theme);
    }
  }, [theme]);

  const resolvedTheme = theme === "system" ? systemTheme : theme;
  function cycleTheme() {
    setTheme((current) => current === "system" ? (resolvedTheme === "dark" ? "light" : "dark") : current === "dark" ? "light" : "system");
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemePreference() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useThemePreference must be used inside ThemeProvider.");
  return context;
}

export function ThemeToggle() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ThemeToggle must be used inside ThemeProvider.");
  const label = context.theme === "system" ? "system" : context.theme;
  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={context.cycleTheme}
      aria-label={`Theme is ${label}. Change theme.`}
      title={`Theme: ${label} · click to change`}
    >
      <span aria-hidden="true">{context.theme === "system" ? "◐" : context.resolvedTheme === "dark" ? "☾" : "☼"}</span>
    </button>
  );
}
