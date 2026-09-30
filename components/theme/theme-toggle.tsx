"use client";

import { useEffect, useState } from "react";
import { THEME_KEY, THEMES, type Theme } from "./theme-script";

const LABEL: Record<Theme, string> = { dark: "Dark", light: "Light", system: "System" };

/**
 * Cycles dark → light → system. Dark is the default; "system" hands the choice
 * to prefers-color-scheme. Writes <html data-theme> (the tokens key off it) and
 * remembers the choice.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null); // null until mounted (unknown on the server)

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "light" || current === "system" ? current : "dark");
  }, []);

  const next = (t: Theme): Theme => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length];

  function cycle() {
    const t = next(theme ?? "dark");
    if (t === "dark") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    try {
      window.localStorage.setItem(THEME_KEY, t);
    } catch {
      // storage blocked: the choice lasts for this page only
    }
    setTheme(t);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={theme ? `Theme: ${LABEL[theme].toLowerCase()}. Switch to ${LABEL[next(theme)].toLowerCase()}` : "Change theme"}
      className="whitespace-nowrap rounded-md border border-rule px-2 py-1 text-sm text-text-dim transition-colors hover:text-text"
    >
      {theme ? LABEL[theme] : "Theme"}
    </button>
  );
}
