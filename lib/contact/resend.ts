import "server-only";

/**
 * Sends email through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
 * No SDK: a single fetch is all the contact form needs.
 */
const ENDPOINT = "https://api.resend.com/emails";

/** Resend's shared test sender; it can only deliver to the Resend account's own address. */
const DEFAULT_FROM = "Portfolio contact form <onboarding@resend.dev>";

export function contactConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.CONTACT_TO_EMAIL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function sendEmail(opts: { subject: string; text: string; replyTo: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !to) throw new Error("Resend is not configured.");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM_EMAIL || DEFAULT_FROM,
      to: [to],
      reply_to: opts.replyTo,
      subject: opts.subject,
      text: opts.text,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    // Resend error bodies are JSON with a `message` field; never include the key.
    const detail = await res.json().then((b: { message?: string }) => b.message).catch(() => undefined);
    throw new Error(`Resend failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }
}
