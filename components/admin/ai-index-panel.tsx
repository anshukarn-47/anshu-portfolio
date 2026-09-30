"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { rebuildAiIndex, type RebuildState } from "@/app/admin/(dashboard)/ai-index-actions";
import { primaryButtonClass } from "./styles";
import { StatusPill } from "@/components/ui/status-pill";

type Props = {
  documents: number;
  chunks: number;
  lastUpdated: string | null;
  keys: { anthropic: boolean; voyage: boolean };
};

function RebuildButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className={primaryButtonClass}>
      {pending ? "Rebuilding…" : "Rebuild AI index"}
    </button>
  );
}

export function AiIndexPanel({ documents, chunks, lastUpdated, keys }: Props) {
  const [state, action] = useActionState<RebuildState>(rebuildAiIndex, { ok: null, message: null });

  return (
    <section aria-labelledby="ai-index-title" className="mt-10 rounded-lg border border-rule p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="ai-index-title" className="font-semibold">
            AI lab index
          </h2>
          <p className="mt-1 text-sm text-text-dim">
            <span className="font-mono tabular-nums">{documents}</span> documents ·{" "}
            <span className="font-mono tabular-nums">{chunks}</span> passages
            {lastUpdated && <> · updated {new Date(lastUpdated).toLocaleString()}</>}
          </p>
          <p className="mt-2 text-sm text-text-dim">
            Rebuild after publishing or editing content so the assistant knows about it. Only published content is indexed.
          </p>
        </div>
        <form action={action}>
          <RebuildButton disabled={!keys.voyage} />
        </form>
      </div>

      <ul className="mt-4 flex flex-wrap gap-3 text-xs">
        <KeyStatus label="ANTHROPIC_API_KEY" ok={keys.anthropic} />
        <KeyStatus label="VOYAGE_API_KEY" ok={keys.voyage} />
      </ul>

      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`mt-4 rounded-md px-3 py-2 text-sm ${
            state.ok
              ? "border border-signal-teal text-text"
              : "border border-signal-red text-text"
          }`}
        >
          {state.message}
        </p>
      )}
    </section>
  );
}

/** A missing key is a real configuration warning, so it's the amber state. */
function KeyStatus({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li>
      <StatusPill tone={ok ? "ok" : "alert"}>
        {label} {ok ? "set" : "missing"}
      </StatusPill>
    </li>
  );
}
