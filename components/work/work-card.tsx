"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { formatMetric } from "@/lib/format";
import type { Metric, WorkSummary } from "@/lib/work";

/**
 * Case study cards take a shape that fits the project instead of one template:
 * - "gauge": scale/crisis stories with a throughput metric (req/sec)
 * - "phone": mobile projects
 * - "stat": AI products, led by their single headline outcome
 * - "data": dashboard/metric-heavy projects get a metric strip
 * - "standard": everything else
 * The outer element carries a framer-motion layoutId that the expanded case
 * study overlay shares, so opening a card morphs it into the detail view.
 */
export type CardVariant = "gauge" | "phone" | "stat" | "data" | "standard";

export function cardVariant(work: WorkSummary): CardVariant {
  if (work.metrics.some((m) => m.unit === "req/sec")) return "gauge";
  if (work.category === "Mobile") return "phone";
  if (work.category === "AI" && work.metrics.length) return "stat";
  if (work.metrics.length >= 2) return "data";
  return "standard";
}

export const workLayoutId = (slug: string) => `work-card-${slug}`;

export function WorkCard({ work, onOpen }: { work: WorkSummary; onOpen?: (e: React.MouseEvent<HTMLAnchorElement>) => void }) {
  const variant = cardVariant(work);
  const meta = [work.category, work.company, work.year].filter(Boolean).join(" · ");

  const text = (
    <div className="min-w-0 flex-1">
      <h3 className="text-xl text-text">{work.title}</h3>
      {meta && <p className="mt-1 text-sm text-text-faint">{meta}</p>}
      {work.summary && <p className="mt-3 text-sm text-text-dim">{work.summary}</p>}
    </div>
  );

  return (
    <motion.article layoutId={workLayoutId(work.slug)} className="h-full rounded-lg border border-rule bg-panel">
      <Link href={`/work/${work.slug}`} onClick={onOpen} className="flex h-full flex-col rounded-lg transition-colors hover:bg-panel-2">
        {variant === "gauge" && <GaugeBody metrics={work.metrics}>{text}</GaugeBody>}
        {variant === "phone" && <PhoneBody metrics={work.metrics}>{text}</PhoneBody>}
        {variant === "stat" && <StatBody metric={work.metrics[0]}>{text}</StatBody>}
        {variant === "data" && (
          <>
            <div className="flex-1 p-5">{text}</div>
            <MetricStrip metrics={work.metrics.slice(0, 3)} />
          </>
        )}
        {variant === "standard" && <div className="flex-1 p-5">{text}</div>}
        <span className="px-5 pb-4 pt-1 text-sm text-text-dim">Read case study →</span>
      </Link>
    </motion.article>
  );
}

function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <dl className="grid border-t border-rule bg-panel-2" style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}>
      {metrics.map((m, i) => (
        <div key={i} className={`px-4 py-3 ${i ? "border-l border-rule" : ""}`}>
          {/* text-dim, not text-faint: this strip sits on --panel-2, where faint is below AA. */}
          <dt className="truncate text-xs text-text-dim">{m.label}</dt>
          <dd className="mt-0.5 font-mono text-base font-medium tabular-nums text-text">{formatMetric(m.value, m.unit)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** AI products: the headline outcome in its own column, text beside it. */
function StatBody({ metric, children }: { metric: Metric; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-5 lg:flex-row">
      <div className="shrink-0 border-rule lg:w-32 lg:border-r lg:pr-4">
        <span className="block font-mono text-2xl font-medium tabular-nums text-text">{formatMetric(metric.value, metric.unit)}</span>
        <span className="mt-1 block text-xs text-text-faint">{metric.label}</span>
      </div>
      {children}
    </div>
  );
}

/** Mobile projects: a phone-frame thumbnail showing the headline metric. */
function PhoneBody({ metrics, children }: { metrics: Metric[]; children: React.ReactNode }) {
  const headline = metrics[0];
  return (
    <div className="flex flex-1 gap-5 p-5">
      <div aria-hidden className="flex h-36 w-[4.5rem] shrink-0 flex-col rounded-lg border-2 border-rule bg-panel-2 p-1.5">
        <div className="mx-auto h-1 w-5 rounded-full bg-rule" />
        <div className="mt-3 flex flex-1 flex-col justify-center gap-1.5 px-1">
          {headline && (
            <>
              <span className="font-mono text-sm font-medium tabular-nums text-text">{formatMetric(headline.value, headline.unit)}</span>
              <span className="h-1 w-full rounded-full bg-rule" />
              <span className="h-1 w-2/3 rounded-full bg-rule" />
              <span className="h-1 w-3/4 rounded-full bg-rule" />
            </>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Pull the baseline out of a context like "up from 10,000". */
function baselineOf(m: Metric): number | null {
  const match = m.context?.match(/up from\s+([\d,.]+)/i);
  const n = match ? Number(match[1].replace(/,/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Crisis/scale stories: a static semicircle gauge from the normal baseline to
 * the peak that was held. Static on purpose: nothing here moves on its own.
 */
function GaugeBody({ metrics, children }: { metrics: Metric[]; children: React.ReactNode }) {
  const peak = metrics.filter((m) => m.unit === "req/sec").sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  const baseline = peak ? baselineOf(peak) : null;
  const share = baseline && peak?.value ? Math.min(1, baseline / peak.value) : null;
  const multiple = baseline && peak?.value ? peak.value / baseline : null;

  // Semicircle arc, radius 40, from 180° (left) to 0° (right).
  const r = 40;
  const arc = `M ${50 - r} 50 A ${r} ${r} 0 0 1 ${50 + r} 50`;
  const length = Math.PI * r;
  const angle = share !== null ? Math.PI * (1 - share) : null; // baseline marker position
  const marker = angle !== null ? { x: 50 + r * Math.cos(angle), y: 50 - r * Math.sin(angle) } : null;

  return (
    <div className="flex flex-1 flex-col gap-4 p-5 lg:flex-row lg:items-start">
      {peak && (
        <figure className="w-40 shrink-0">
          <svg viewBox="0 0 100 58" className="w-full" role="img" aria-label={`Peak ${formatMetric(peak.value, peak.unit)}${baseline ? `, up from ${baseline.toLocaleString("en")}` : ""}`}>
            <path d={arc} fill="none" stroke="var(--rule)" strokeWidth="6" strokeLinecap="round" />
            <path d={arc} fill="none" stroke="var(--signal-teal)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${length} ${length}`} />
            {marker && <circle cx={marker.x} cy={marker.y} r="3.5" fill="var(--panel)" stroke="var(--text-dim)" strokeWidth="1.5" />}
          </svg>
          <figcaption className="-mt-3 text-center">
            <span className="block font-mono text-lg font-medium tabular-nums text-text">{formatMetric(peak.value, peak.unit)}</span>
            {multiple && (
              <span className="block text-xs text-text-faint">
                <span className="font-mono">{formatMetric(Math.round(multiple * 10) / 10, "x")}</span> normal load
              </span>
            )}
          </figcaption>
        </figure>
      )}
      {children}
    </div>
  );
}
