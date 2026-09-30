import type { Tradeoff } from "@/lib/prototypes/registry";

/** Trade-offs: each pair of options, the one chosen (marked), and why. */
export function TradeoffPanel({ tradeoffs, headingLevel = 3 }: { tradeoffs: Tradeoff[]; headingLevel?: 2 | 3 }) {
  if (!tradeoffs.length) return null;
  const Heading = `h${headingLevel}` as const;
  return (
    <section aria-labelledby="tradeoff-panel-title">
      <Heading id="tradeoff-panel-title" className="text-base">
        Trade-offs
      </Heading>
      <ul className="mt-3 space-y-4">
        {tradeoffs.map((t) => (
          <li key={`${t.a}|${t.b}`} className="text-sm">
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <Option label={t.a} chosen={t.choice === t.a} />
              <span className="text-xs text-text-faint">vs</span>
              <Option label={t.b} chosen={t.choice === t.b} />
            </p>
            <p className="mt-1.5 text-text-dim">{t.why}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Option({ label, chosen }: { label: string; chosen: boolean }) {
  return chosen ? (
    <span className="rounded border border-signal-teal px-1.5 py-0.5 text-text">
      <span aria-hidden className="text-signal-teal">✓ </span>
      {label}
      <span className="sr-only"> (chosen)</span>
    </span>
  ) : (
    <span className="rounded border border-rule px-1.5 py-0.5 text-text-dim">{label}</span>
  );
}
