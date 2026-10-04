const isDev = process.env.NODE_ENV !== "production";

// The Supabase project, for any browser-side Supabase call (auth, realtime).
const supabase = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return null;
  }
})();

/**
 * Content Security Policy.
 * - Scripts and styles need 'unsafe-inline': the App Router inlines its hydration
 *   scripts and framer-motion sets inline styles. Nonces would force every page to
 *   render dynamically (no static or cached pages), so they're not used.
 * - Fonts are self-hosted by next/font. Images and prototype embeds can be any
 *   https URL set in /admin.
 * - Development adds 'unsafe-eval' and websockets for Fast Refresh.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${supabase ? ` ${supabase} ${supabase.replace(/^http/, "ws")}` : ""}${isDev ? " ws: wss:" : ""}`,
  "frame-src https:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  // HTTPS only (browsers ignore it over plain http, e.g. localhost). No `preload`: that's a separate, hard-to-undo commitment.
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  async redirects() {
    // Knowledge maze was replaced by Neural Maze; keep old links working.
    return [{ source: "/arcade/knowledge-maze", destination: "/arcade/neural-maze", permanent: true }];
  },
};

export default nextConfig;
