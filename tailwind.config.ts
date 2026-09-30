import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

/**
 * Flight Deck. Colours map to the CSS tokens in app/globals.css, so every class
 * (bg-ink, border-rule, text-text-dim, text-signal-teal…) follows the active theme.
 */
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        panel: { DEFAULT: "var(--panel)", 2: "var(--panel-2)" },
        rule: "var(--rule)",
        text: { DEFAULT: "var(--text)", dim: "var(--text-dim)", faint: "var(--text-faint)" },
        signal: {
          teal: "var(--signal-teal)",
          amber: "var(--signal-amber)",
          red: "var(--signal-red)",
          blue: "var(--signal-blue)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-space-grotesk)", "var(--font-inter)", "system-ui", "sans-serif"],
        // Measurements only: counts, percentages, rates, dates in data. Never decoration.
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      // Type scale: each size carries its own line height (tighter as size grows).
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1.125rem" }],
        sm: ["0.875rem", { lineHeight: "1.375rem" }],
        base: ["1rem", { lineHeight: "1.625rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem", letterSpacing: "-0.005em" }],
        "2xl": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.01em" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.015em" }],
        "4xl": ["2.25rem", { lineHeight: "2.625rem", letterSpacing: "-0.02em" }],
        "5xl": ["3rem", { lineHeight: "3.25rem", letterSpacing: "-0.025em" }],
      },
      maxWidth: {
        prose: "75ch", // body copy measure
      },
      borderRadius: {
        DEFAULT: "6px",
        md: "6px",
        lg: "8px",
      },
      animation: {
        "status-pulse": "status-pulse 2.2s ease-out infinite",
        skeleton: "skeleton-pulse 1.6s ease-in-out infinite",
      },
      typography: {
        flight: {
          css: {
            "--tw-prose-body": "var(--text)",
            "--tw-prose-headings": "var(--text)",
            "--tw-prose-lead": "var(--text-dim)",
            "--tw-prose-links": "var(--text)",
            "--tw-prose-bold": "var(--text)",
            "--tw-prose-counters": "var(--text-faint)",
            "--tw-prose-bullets": "var(--text-faint)",
            "--tw-prose-hr": "var(--rule)",
            "--tw-prose-quotes": "var(--text-dim)",
            "--tw-prose-quote-borders": "var(--rule)",
            "--tw-prose-captions": "var(--text-dim)",
            "--tw-prose-code": "var(--text)",
            "--tw-prose-pre-code": "var(--text)",
            "--tw-prose-pre-bg": "var(--panel-2)",
            "--tw-prose-th-borders": "var(--rule)",
            "--tw-prose-td-borders": "var(--rule)",
            maxWidth: "75ch",
            "h2, h3, h4": { fontFamily: "var(--font-space-grotesk)", fontWeight: "600" },
            a: { textDecorationColor: "var(--rule)", textUnderlineOffset: "3px" },
            "a:hover": { textDecorationColor: "var(--signal-teal)" },
          },
        },
      },
    },
  },
  plugins: [typography],
};
export default config;
