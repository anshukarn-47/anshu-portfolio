"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { PublicSkill, SkillCategory } from "@/lib/skills";
import { isSafeSrc, toAnchor } from "@/lib/format";
import { FilterChips, toggled } from "@/components/ui/filter-chips";

export type RailWork = { slug: string; title: string; category: string | null };

const REFLOW_S = 0.22; // under 300ms: reads as responsive, not slow

/**
 * Skills page body:
 * - Category filters; toggling reflows the cards into their new positions
 *   (framer layout + AnimatePresence popLayout) instead of jumping.
 * - Hovering a skill, or focusing a link inside it, highlights the case studies
 *   that use it (work_skills) in the rail beside the grid; cleared on leave/blur.
 * Reduced motion: layout moves are instant (MotionConfig) and fades are skipped.
 */
export function SkillsExplorer({ categories, work }: { categories: SkillCategory[]; work: RailWork[] }) {
  const reduceMotion = useReducedMotion();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeSkill, setActiveSkill] = useState<PublicSkill | null>(null);

  const visible = selected.size ? categories.filter((c) => selected.has(c.name)) : categories;
  const highlighted = useMemo(() => new Set(activeSkill?.work.map((w) => w.slug) ?? []), [activeSkill]);
  const transition = reduceMotion ? { duration: 0 } : { duration: REFLOW_S, ease: [0.2, 0, 0, 1] as const };

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div>
        {categories.length > 1 && (
          <FilterChips
            label="Filter skills by category"
            options={categories.map((c) => ({ value: c.name, count: c.skills.length }))}
            selected={selected}
            onToggle={(v) => setSelected((s) => toggled(s, v))}
            onClear={() => setSelected(new Set())}
          />
        )}

        <div className="mt-10 space-y-12">
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((c) => (
              <motion.section
                key={c.name}
                layout
                id={toAnchor(c.name)}
                aria-labelledby={`${toAnchor(c.name)}-title`}
                className="scroll-mt-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transition}
              >
                <motion.h2 layout="position" id={`${toAnchor(c.name)}-title`} className="text-2xl" transition={transition}>
                  {c.name}
                </motion.h2>
                <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {c.skills.map((s) => (
                    <motion.li key={s.id} layout transition={transition}>
                      <SkillCard
                        skill={s}
                        onActivate={() => setActiveSkill(s)}
                        onDeactivate={() => setActiveSkill((cur) => (cur?.id === s.id ? null : cur))}
                      />
                    </motion.li>
                  ))}
                </ul>
              </motion.section>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {work.length > 0 && (
        // Hover needs a pointer and room beside the grid, so the rail is large screens only.
        <aside aria-labelledby="rail-title" className="hidden lg:block">
          <div className="sticky top-6">
            <h2 id="rail-title" className="text-base">
              Case studies
            </h2>
            <p className="mt-1 text-xs text-text-faint">
              {activeSkill ? `Using ${activeSkill.name}: ${highlighted.size || "none"}` : "Hover a skill to see where it's used"}
            </p>
            <ul className="mt-3 space-y-1.5">
              {work.map((w) => {
                const on = highlighted.has(w.slug);
                return (
                  <li key={w.slug}>
                    <Link
                      href={`/work/${w.slug}`}
                      className={`block rounded-md border border-l-2 px-3 py-2 text-sm motion-safe:transition-colors ${
                        on ? "border-rule border-l-signal-teal bg-panel-2 text-text" : "border-rule border-l-transparent bg-panel text-text-dim"
                      }`}
                    >
                      {w.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      )}
    </div>
  );
}

function SkillCard({ skill, onActivate, onDeactivate }: { skill: PublicSkill; onActivate: () => void; onDeactivate: () => void }) {
  const usedIn = skill.work.length + skill.certifications.length;
  return (
    <article
      id={skill.slug}
      onMouseEnter={onActivate}
      onMouseLeave={onDeactivate}
      onFocus={onActivate}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onDeactivate();
      }}
      className="flex h-full scroll-mt-8 flex-col rounded-lg border border-rule bg-panel p-4 data-[hash-target]:border-text-dim data-[hash-target]:bg-panel-2"
    >
      <div className="flex items-start gap-3">
        {isSafeSrc(skill.icon) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={skill.icon} alt="" className="h-7 w-7 shrink-0 rounded object-contain" loading="lazy" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-base text-text">
            {skill.name}
            {skill.featured && <span className="ml-2 font-sans text-xs font-normal text-text-faint">Core skill</span>}
          </h3>
          {skill.description && <p className="mt-1 text-sm text-text-dim">{skill.description}</p>}
        </div>
      </div>

      {usedIn > 0 && (
        <dl className="mt-auto space-y-2 pt-4 text-sm">
          {skill.work.length > 0 && (
            <div>
              <dt className="text-text-faint">Used in</dt>
              <dd className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                {skill.work.map((w) => (
                  <Link key={w.slug} href={`/work/${w.slug}`} className="text-text-dim underline decoration-rule underline-offset-2 hover:text-text hover:decoration-text-dim">
                    {w.title}
                  </Link>
                ))}
              </dd>
            </div>
          )}
          {skill.certifications.length > 0 && (
            <div>
              <dt className="text-text-faint">Certified</dt>
              <dd className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                {skill.certifications.map((c) => (
                  <Link key={c.id} href={`/certifications#${c.id}`} className="text-text-dim underline decoration-rule underline-offset-2 hover:text-text hover:decoration-text-dim">
                    {c.name}
                  </Link>
                ))}
              </dd>
            </div>
          )}
        </dl>
      )}
    </article>
  );
}
