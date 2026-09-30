import type { Measures } from "@/lib/prototypes/registry";

const ROWS: { key: keyof Measures; label: string }[] = [
  { key: "primary", label: "Primary metric" },
  { key: "guardrail", label: "Guardrail" },
  { key: "leadingIndicator", label: "Leading indicator" },
  { key: "failureMode", label: "Failure mode" },
];

/** "What I'd measure": the four measures from the prototype's registry entry. */
export function MetricsPanel({ measures, headingLevel = 3 }: { measures: Measures; headingLevel?: 2 | 3 }) {
  const Heading = `h${headingLevel}` as const;
  return (
    <section aria-labelledby="metrics-panel-title">
      <Heading id="metrics-panel-title" className="text-base">
        What I&apos;d measure
      </Heading>
      <dl className="mt-3 space-y-3">
        {ROWS.map(({ key, label }) => (
          <div key={key}>
            <dt className="font-mono text-xs uppercase tracking-wider text-signal-blue">{label}</dt>
            <dd className="mt-0.5 text-sm text-text-dim">{measures[key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
