import { requireAdmin } from "@/lib/auth";
import { StatusPill } from "@/components/ui/status-pill";
import { LocalTime } from "@/components/admin/local-time";
import { DeleteMessageButton } from "@/components/admin/delete-message-button";
import { secondaryButtonClass } from "@/components/admin/styles";
import { adminError } from "@/lib/admin/errors";

const STATUS = {
  sent: { tone: "ok", label: "emailed" },
  failed: { tone: "alert", label: "email failed" },
  pending: { tone: "idle", label: "sending" },
} as const;

/**
 * Contact form messages, newest first. Every message is also emailed; this is
 * the record, and the only copy when an email failed.
 */
export default async function MessagesPage(props: { searchParams: Promise<{ deleted?: string; error?: string }> }) {
  const searchParams = await props.searchParams;
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("contact_messages")
    .select("id, name, email, message, email_status, created_at")
    .order("created_at", { ascending: false });
  const messages = data ?? [];
  const failed = messages.filter((m) => m.email_status === "failed").length;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
      <p className="mt-1 text-sm text-text-dim">
        {messages.length} {messages.length === 1 ? "message" : "messages"} from the contact form on your About page
        {failed > 0 && (
          <>
            , <span className="text-text">{failed} not emailed</span>
          </>
        )}
        .
      </p>

      {searchParams.deleted && (
        <p role="status" className="mt-6 rounded-md border border-signal-teal px-3 py-2 text-sm text-text">
          Deleted.
        </p>
      )}
      {(error || searchParams.error) && (
        <p role="alert" className="mt-6 rounded-md border border-signal-red px-3 py-2 text-sm text-text">
          {error
            ? adminError("load contact messages", error, "Couldn't load messages. Please reload the page.")
            : "Couldn't delete that message. Please try again."}
        </p>
      )}

      {messages.length === 0 && !error ? (
        <div className="mt-8 rounded-lg border border-dashed border-rule p-10 text-center">
          <p className="text-sm text-text-dim">No messages yet.</p>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {messages.map((m) => {
            const status = STATUS[m.email_status as keyof typeof STATUS] ?? STATUS.pending;
            return (
              <li key={m.id}>
                <article aria-labelledby={`message-${m.id}`} className="rounded-lg border border-rule bg-panel p-4 sm:p-5">
                  <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <h2 id={`message-${m.id}`} className="font-sans text-base font-medium text-text">
                        {m.name}
                      </h2>
                      <p className="break-all text-sm text-text-dim">{m.email}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-faint">
                      <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      <LocalTime iso={m.created_at} />
                    </div>
                  </header>

                  <p className="mt-4 whitespace-pre-wrap break-words text-sm text-text">{m.message}</p>

                  {m.email_status === "failed" && (
                    <p className="mt-3 text-xs text-text-dim">
                      This message wasn&apos;t delivered to your inbox, so this is the only copy.
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule pt-4">
                    <a
                      href={`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent("Re: your message on my portfolio")}`}
                      className={secondaryButtonClass}
                    >
                      Reply by email
                    </a>
                    <DeleteMessageButton id={m.id} from={m.name} />
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
