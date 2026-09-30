"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { PublicAchievement } from "@/lib/achievements";
import { formatMetric, formatMonthYear } from "@/lib/format";
import { FilterChips, toggled } from "@/components/ui/filter-chips";

const REFLOW_S = 0.22; // under 300ms: reads as responsive, not slow

/**
 * Achievements grid with category filters. Toggling a filter animates the
 * remaining cards into their new positions (framer layout + AnimatePresence
 * popLayout). Reduced motion: instant positions, no fades.
 */
export function AchievementsBrowser({ achievements }: { achievements: PublicAchievement[] }) {
  const reduceMotion = useReducedMotion();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const counts = new Map<string, number>();
  for (const a of achievements) if (a.category) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
  const options = Array.from(counts, ([value, count]) => ({ value, count }));
  const visible = selected.size ? achievements.filter((a) => a.category && selected.has(a.category)) : achievements;
  const transition = reduceMotion ? { duration: 0 } : { duration: REFLOW_S, ease: [0.2, 0, 0, 1] as const };

  return (
    <>
      {options.length > 1 && (
        <div className="mt-8">
          <FilterChips
            label="Filter achievements by category"
            options={options}
            selected={selected}
            onToggle={(v) => setSelected((s) => toggled(s, v))}
            onClear={() => setSelected(new Set())}
          />
        </div>
      )}
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {visible.map((a) => (
            <motion.li
              key={a.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transition}
            >
              <AchievementCard achievement={a} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </>
  );
}

function AchievementCard({ achievement: a }: { achievement: PublicAchievement }) {
  const metric = formatMetric(a.metric_value, a.metric_unit);
  const date = formatMonthYear(a.date);

  return (
    <article className="flex h-full flex-col rounded-lg border border-rule bg-panel p-5">
      <h2 className={metric ? "font-sans text-sm font-normal text-text-faint" : "text-lg text-text"}>{a.title}</h2>
      {metric && <p className="mt-2 font-mono text-4xl font-medium tabular-nums text-text">{metric}</p>}
      {a.metric_context && <p className="mt-1 text-sm text-text-dim">{a.metric_context}</p>}
      {a.description && <p className="mt-3 text-sm text-text-dim">{a.description}</p>}

      <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-5 text-sm">
        <span className="text-text-faint">
          {a.category}
          {a.category && date && " · "}
          {date && <span className="font-mono tabular-nums">{date}</span>}
        </span>
        {a.work && (
          <Link href={`/work/${a.work.slug}`} className="rounded-md text-text-dim hover:text-text">
            Case study →
          </Link>
        )}
      </div>
    </article>
  );
}
