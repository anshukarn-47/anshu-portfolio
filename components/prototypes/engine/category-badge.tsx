import type { PrototypeCategory } from "@/lib/prototypes/registry";

/** Prototype category (Think, Build, Analyze, Build with AI): an informational accent, so blue. */
export function CategoryBadge({ category }: { category: PrototypeCategory }) {
  return (
    <span className="inline-flex items-center rounded-full border border-rule px-2 py-0.5 font-mono text-xs text-signal-blue">
      {category}
    </span>
  );
}
