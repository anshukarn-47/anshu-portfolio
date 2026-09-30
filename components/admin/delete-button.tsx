"use client";

import { useFormStatus } from "react-dom";
import { deleteEntity } from "@/app/admin/(dashboard)/[entity]/actions";

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

export function DeleteButton({ entityKey, id, label }: { entityKey: string; id: string; label: string }) {
  return (
    <form
      action={deleteEntity.bind(null, entityKey, id)}
      onSubmit={(e) => {
        if (!window.confirm(`Delete “${label}”? This can't be undone.`)) e.preventDefault();
      }}
    >
      <Button />
    </form>
  );
}
