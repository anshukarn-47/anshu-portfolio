"use client";

import { useFormStatus } from "react-dom";
import { deleteMessage } from "@/app/admin/(dashboard)/messages/actions";

function Button() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-signal-red px-3 py-1.5 text-sm text-signal-red transition-colors hover:bg-panel-2 disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}

export function DeleteMessageButton({ id, from }: { id: number; from: string }) {
  return (
    <form
      action={deleteMessage.bind(null, id)}
      onSubmit={(e) => {
        if (!window.confirm(`Delete the message from “${from}”? This can't be undone.`)) e.preventDefault();
      }}
    >
      <Button />
    </form>
  );
}
