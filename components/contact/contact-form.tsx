"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { sendContactMessage } from "@/lib/contact/actions";
import { CONTACT_LIMITS, type ContactField, type ContactState } from "@/lib/contact/shared";

const inputClass =
  "mt-1.5 w-full rounded-md border bg-ink px-3 py-2 text-sm text-text placeholder:text-text-faint aria-[invalid=true]:border-signal-red";

/**
 * Name, email, message, send. Posts to a server action, so it also works
 * without JavaScript. Errors show under each field; on success the form is
 * replaced by a confirmation.
 */
export function ContactForm() {
  const [state, action] = useActionState<ContactState, FormData>(sendContactMessage, { status: "idle" });
  const formRef = useRef<HTMLFormElement>(null);
  const sentRef = useRef<HTMLParagraphElement>(null);

  // Move focus to the first field with an error, or to the confirmation.
  useEffect(() => {
    if (state.status === "invalid") {
      const first = (["name", "email", "message"] as const).find((f) => state.errors[f]);
      if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    } else if (state.status === "sent") {
      sentRef.current?.focus();
    }
  }, [state]);

  if (state.status === "sent") {
    return (
      <p ref={sentRef} tabIndex={-1} role="status" className="mt-4 rounded-lg border border-rule bg-panel px-4 py-3 text-sm text-text">
        Thanks, your message has been sent. You&apos;ll get a reply by email.
      </p>
    );
  }

  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" || state.status === "error" ? state.values : null;

  const field = (name: ContactField) => ({
    id: `contact-${name}`,
    name,
    defaultValue: values?.[name] ?? "",
    maxLength: CONTACT_LIMITS[name],
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `contact-${name}-error` : undefined,
    className: `${inputClass} ${errors[name] ? "" : "border-rule"}`,
  });

  return (
    <form ref={formRef} action={action} noValidate className="mt-4 max-w-xl space-y-4">
      <div>
        <label htmlFor="contact-name" className="text-sm text-text">
          Name
        </label>
        <input type="text" autoComplete="name" required {...field("name")} />
        <FieldError name="name" message={errors.name} />
      </div>
      <div>
        <label htmlFor="contact-email" className="text-sm text-text">
          Email
        </label>
        <input type="email" autoComplete="email" required {...field("email")} />
        <FieldError name="email" message={errors.email} />
      </div>
      <div>
        <label htmlFor="contact-message" className="text-sm text-text">
          Message
        </label>
        <textarea rows={6} required {...field("message")} className={`${field("message").className} resize-y`} />
        <FieldError name="message" message={errors.message} />
      </div>

      {/* Honeypot: invisible to people and screen readers; bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-company">Company</label>
        <input id="contact-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state.status === "error" && (
        <p role="alert" className="rounded-md border border-signal-amber px-3 py-2 text-sm text-text">
          {state.message}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}

function FieldError({ name, message }: { name: ContactField; message?: string }) {
  if (!message) return null;
  return (
    <p id={`contact-${name}-error`} className="mt-1 text-sm text-signal-red">
      {message}
    </p>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Sending…" : "Send message"}
    </button>
  );
}
