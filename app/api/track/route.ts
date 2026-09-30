import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { TRACKED_EVENTS, isUntrackedPath, type TrackedEvent } from "@/lib/analytics/shared";
import { readJsonBody } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Privacy-friendly analytics endpoint. No cookies, nothing stored in the browser,
 * no raw IP address or user agent kept. Each event stores only: the event name,
 * the path (no query string), the referring site's domain, a country code when
 * the host provides one, and a visitor id that is a keyed hash of
 * (UTC day, IP, user agent). That id changes every day, so visitors are counted
 * once per day and can't be followed from one day to the next.
 */

const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|monitor|curl|wget|python|axios|node-fetch/i;

// Per-instance flood guard: at most 60 events a minute per visitor hash.
const PER_MINUTE = 60;
const recent = new Map<string, { minute: number; count: number }>();

const noContent = () => new Response(null, { status: 204 });

function visitorHash(ip: string, userAgent: string): string {
  const secret = process.env.ANALYTICS_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const day = new Date().toISOString().slice(0, 10);
  return createHmac("sha256", secret).update(`${day}|${ip}|${userAgent}`).digest("hex").slice(0, 32);
}

/** Just the referring site's domain, and only for other sites. */
function referrerHost(raw: unknown, ownHost: string | null): string | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (!host || (ownHost && host === ownHost.replace(/^www\./, "").split(":")[0].toLowerCase())) return null;
    return host.slice(0, 100);
  } catch {
    return null;
  }
}

/** A clean site path: no query string or fragment, bounded length. */
function cleanPath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return null;
  const path = raw.split(/[?#]/)[0].slice(0, 200);
  return path || null;
}

export async function POST(request: Request) {
  // Local development shares the production database: don't let it inflate real numbers.
  if (process.env.NODE_ENV !== "production" && process.env.ANALYTICS_IN_DEV !== "1") return noContent();

  const h = request.headers;
  // Honour Do Not Track and Global Privacy Control.
  if (h.get("dnt") === "1" || h.get("sec-gpc") === "1") return noContent();
  const userAgent = h.get("user-agent") ?? "";
  if (!userAgent || BOT_RE.test(userAgent)) return noContent();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return noContent();

  // An event is a name, a path, a referrer and a target: a few hundred bytes.
  const read = await readJsonBody(request, 4 * 1024);
  if (!read.ok) return new Response(null, { status: read.tooLarge ? 413 : 400 });
  const body = (read.body ?? {}) as Record<string, unknown>;

  const name = body.name as TrackedEvent;
  const path = cleanPath(body.path);
  if (!TRACKED_EVENTS.includes(name) || !path) return new Response(null, { status: 400 });
  if (isUntrackedPath(path)) return noContent();

  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const visitor = visitorHash(ip, userAgent);

  const minute = Math.floor(Date.now() / 60_000);
  const seen = recent.get(visitor);
  if (seen && seen.minute === minute && seen.count >= PER_MINUTE) return noContent();
  recent.set(visitor, { minute, count: seen && seen.minute === minute ? seen.count + 1 : 1 });
  if (recent.size > 10_000) recent.clear();

  const country = (h.get("x-vercel-ip-country") || h.get("cf-ipcountry") || "").toUpperCase();
  const target = typeof body.target === "string" ? body.target.slice(0, 200) : null;

  const { error } = await createAdminClient()
    .from("analytics_events")
    .insert({
      event_name: name,
      path,
      referrer: name === "pageview" ? referrerHost(body.referrer, h.get("host")) : null,
      visitor_id: visitor,
      country: /^[A-Z]{2}$/.test(country) && country !== "XX" ? country : null,
      properties: target ? { target } : {},
    });
  if (error) console.error("[track] could not record event", error);
  return noContent();
}
