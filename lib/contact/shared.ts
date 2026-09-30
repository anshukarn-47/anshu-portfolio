/** Contact form types and limits, shared by the server action and the form. */
export const CONTACT_LIMITS = { name: 100, email: 254, message: 5000 };

export type ContactField = "name" | "email" | "message";

export type ContactState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "invalid"; errors: Partial<Record<ContactField, string>>; values: Record<ContactField, string> }
  | { status: "error"; message: string; values: Record<ContactField, string> };
