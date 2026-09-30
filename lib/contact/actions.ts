"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { visitorId } from "@/lib/rag/limits";
import { contactConfigured, sendEmail } from "./resend";
import { CONTACT_LIMITS, type ContactField, type ContactState } from "./shared";

/** Caps to stop abuse and stay inside Resend's free tier (100 emails a day). */
const HOURLY_PER_VISITOR = 3;
const DAILY_SITE_WIDE = 50;

// Deliberately loose: one @, something on both sides, a dot in the domain.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FAILED = "Your message couldn't be sent right now. Please try again later.";

function validate(name: string, email: string, message: string): Partial<Record<ContactField, string>> {
  const errors: Partial<Record<ContactField, string>> = {};
  if (!name) errors.name = "Enter your name.";
  else if (name.length > CONTACT_LIMITS.name) errors.name = `Keep your name under ${CONTACT_LIMITS.name} characters.`;
  if (!email) errors.email = "Enter your email address.";
  else if (email.length > CONTACT_LIMITS.email || !EMAIL_RE.test(email)) errors.email = "Enter a valid email address, like name@example.com.";
  if (!message) errors.message = "Enter a message.";
  else if (message.length > CONTACT_LIMITS.message) {
    errors.message = `Keep your message under ${CONTACT_LIMITS.message.toLocaleString("en")} characters.`;
  }
  return errors;
}

export async function sendContactMessage(_prev: ContactState, form: FormData): Promise<ContactState> {
  const field = (key: string) => (typeof form.get(key) === "string" ? (form.get(key) as string).trim() : "");
  const name = field("name").replace(/\s+/g, " "); // single line: it goes into the subject
  const email = field("email");
  const message = field("message").replace(/\r\n?/g, "\n");
  const values = { name, email, message };

  // Honeypot: hidden from people, filled in by bots. Pretend it worked.
  if (field("company")) return { status: "sent" };

  const errors = validate(name, email, message);
  if (Object.keys(errors).length) return { status: "invalid", errors, values };
  if (!contactConfigured()) return { status: "error", message: FAILED, values };

  const db = createAdminClient();
  const visitor = visitorId(await headers());

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [mine, all] = await Promise.all([
    db.from("contact_messages").select("id", { count: "exact", head: true }).eq("visitor_id", visitor).gte("created_at", hourAgo),
    db.from("contact_messages").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
  ]);
  if (mine.error || all.error) {
    console.error("[contact] rate limit check failed", mine.error ?? all.error);
    return { status: "error", message: FAILED, values };
  }
  if ((mine.count ?? 0) >= HOURLY_PER_VISITOR || (all.count ?? 0) >= DAILY_SITE_WIDE) {
    return { status: "error", message: "You've sent several messages already. Please try again later.", values };
  }

  // Saved first, so a message is never lost if the email fails.
  const { data: row, error: insertError } = await db
    .from("contact_messages")
    .insert({ name, email, message, visitor_id: visitor })
    .select("id")
    .single();
  if (insertError) {
    console.error("[contact] could not save message", insertError);
    return { status: "error", message: FAILED, values };
  }

  let emailStatus: "sent" | "failed" = "sent";
  try {
    await sendEmail({
      subject: `Portfolio contact from ${name}`,
      replyTo: email,
      text: `${message}\n\n---\nFrom: ${name} <${email}>\nSent from the contact form on your portfolio. Reply to this email to answer.`,
    });
  } catch (err) {
    console.error("[contact] email failed", err);
    emailStatus = "failed";
  }

  const { error: updateError } = await db.from("contact_messages").update({ email_status: emailStatus }).eq("id", row.id);
  if (updateError) console.error("[contact] could not update status", updateError);

  return emailStatus === "sent" ? { status: "sent" } : { status: "error", message: FAILED, values };
}
