import { ImageResponse } from "next/og";
import { getProfile } from "@/lib/profile";
import { getHeroMetrics } from "@/lib/highlights";
import { formatMetric } from "@/lib/format";
import { SITE_ROLE, SITE_URL } from "@/lib/site";

/**
 * The link-preview image (og:image / twitter:image) for every page: name,
 * role, headline and the homepage's hero metrics, in the Flight Deck palette.
 * Generated from the profile and published work, and refreshed with them.
 */
export const alt = "Portfolio preview: name, role and headline metrics";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const C = { ink: "#0e1216", panel: "#171b20", rule: "#2b323a", text: "#e7ecef", dim: "#93a0ac", faint: "#7d8894", teal: "#4fd1c5" };

export default async function OpengraphImage() {
  const [profile, metrics] = await Promise.all([getProfile().catch(() => null), getHeroMetrics().catch(() => [])]);
  const name = profile?.full_name ?? "Portfolio";
  const headline = profile?.headline ?? null;
  const host = new URL(SITE_URL).host;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.ink, padding: "64px 72px", color: C.text }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 24, color: C.dim }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: C.teal }} />
          <div style={{ display: "flex", letterSpacing: 2, textTransform: "uppercase" }}>{SITE_ROLE}</div>
        </div>

        <div style={{ display: "flex", marginTop: 36, fontSize: 84, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>{name}</div>
        {headline && (
          <div style={{ display: "flex", marginTop: 20, fontSize: 34, lineHeight: 1.3, color: C.dim, maxWidth: 1000 }}>
            {headline.length > 110 ? `${headline.slice(0, 107)}…` : headline}
          </div>
        )}

        <div style={{ display: "flex", marginTop: "auto", gap: 20 }}>
          {metrics.slice(0, 3).map((m) => (
            <div
              key={m.key}
              style={{ display: "flex", flexDirection: "column", flex: 1, background: C.panel, border: `2px solid ${C.rule}`, borderRadius: 14, padding: "20px 24px" }}
            >
              <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>{formatMetric(m.value, m.unit)}</div>
              <div style={{ display: "flex", marginTop: 6, fontSize: 22, color: C.dim }}>{m.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28, fontSize: 22, color: C.faint }}>
          <div style={{ display: "flex" }}>Case studies · AI lab · Prototypes</div>
          <div style={{ display: "flex" }}>{host}</div>
        </div>
      </div>
    ),
    size
  );
}
