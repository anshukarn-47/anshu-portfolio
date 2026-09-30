/**
 * Theme choice storage, shared by the pre-paint script and the toggle.
 * Values: "dark" (default), "light", "system" (follow the OS).
 */
export const THEME_KEY = "flightdeck:theme";
export const THEMES = ["dark", "light", "system"] as const;
export type Theme = (typeof THEMES)[number];

/**
 * Inline <head> script: applies the saved theme to <html data-theme> before the
 * first paint, so a light-theme visitor never sees a flash of dark (or vice versa).
 */
export function ThemeScript() {
  const js = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="system")document.documentElement.dataset.theme=t}catch(e){}`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
