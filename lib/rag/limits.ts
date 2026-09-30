import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/** Per-visitor and site-wide caps on questions, to bound spend on a public endpoint. */
const HOURLY_PER_VISITOR = Number(process.env.AI_LAB_HOURLY_LIMIT ?? 20);
const DAILY_SITE_WIDE = Number(process.env.AI_LAB_DAILY_LIMIT ?? 300);

/**
 * Anonymous, stable visitor id: a salted hash of the client IP. The raw IP is
 * never stored.
 */
export function visitorId(headers: Headers): string {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
  const salt = process.env.AI_LAB_VISITOR_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export type LimitResult = { ok: true } | { ok: false; message: string };

export async function checkLimits(visitor: string): Promise<LimitResult> {
  const db = createAdminClient();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [mine, all] = await Promise.all([
    db
      .from("chat_messages")
      .select("id, chat_sessions!inner(visitor_id)", { count: "exact", head: true })
      .eq("role", "user")
      .eq("chat_sessions.visitor_id", visitor)
      .gte("created_at", hourAgo),
    db.from("chat_messages").select("id", { count: "exact", head: true }).eq("role", "user").gte("created_at", dayAgo),
  ]);
  if (mine.error || all.error) throw new Error(`Rate limit check failed: ${(mine.error ?? all.error)!.message}`);

  if ((all.count ?? 0) >= DAILY_SITE_WIDE) {
    return { ok: false, message: "The AI Lab has reached its daily question limit. Please try again tomorrow." };
  }
  if ((mine.count ?? 0) >= HOURLY_PER_VISITOR) {
    return { ok: false, message: "You've asked a lot of questions this hour. Please try again a little later." };
  }
  return { ok: true };
}
