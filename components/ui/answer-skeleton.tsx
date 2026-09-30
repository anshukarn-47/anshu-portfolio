/**
 * Placeholder in the shape of an incoming streamed answer, shown only while
 * waiting for the first token (callers replace it as soon as content arrives).
 * The soft pulse is motion-safe; with reduced motion it's static.
 */
export function AnswerSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="max-w-prose space-y-2 py-1">
      <span className="sr-only">{label}</span>
      {["w-11/12", "w-full", "w-3/4"].map((w) => (
        <div key={w} aria-hidden className={`h-3.5 rounded bg-panel-2 motion-safe:animate-skeleton ${w}`} />
      ))}
    </div>
  );
}
