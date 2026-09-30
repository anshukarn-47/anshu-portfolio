"use client";

/**
 * Toggle filters. Each option is an aria-pressed button; with nothing selected
 * everything shows. "All" clears the selection.
 */
export function FilterChips({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string;
  options: { value: string; count: number }[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const chip = (active: boolean) =>
    `flex items-center gap-2 rounded-md border px-3 py-1 text-sm transition-colors ${
      active ? "border-text bg-panel-2 text-text" : "border-rule text-text-dim hover:text-text"
    }`;

  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      <button type="button" aria-pressed={selected.size === 0} onClick={onClear} className={chip(selected.size === 0)}>
        All
      </button>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={selected.has(o.value)} onClick={() => onToggle(o.value)} className={chip(selected.has(o.value))}>
          {o.value}
          <span className="font-mono text-xs tabular-nums text-text-faint">{o.count}</span>
        </button>
      ))}
    </div>
  );
}

/** Small hook-free helper: toggle membership in a Set, returning a new Set. */
export function toggled(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
