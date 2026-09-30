import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { adminError } from "@/lib/admin/errors";

type Summary = {
  since: string;
  pageviews: number;
  visitors: number;
  daily: { date: string; pageviews: number; visitors: number }[];
  pages: { path: string; pageviews: number; visitors: number }[];
  referrers: { referrer: string; visitors: number }[];
  events: Record<string, number>;
  ai_questions: number;
  agent_runs: number;
  contact_messages: number;
};

const RANGES = [7, 30, 90] as const;

const nf = new Intl.NumberFormat("en");
const plural = (n: number, word: string) => `${nf.format(n)} ${word}${n === 1 ? "" : "s"}`;
const shortDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso));

/**
 * Engagement at a glance, from the privacy-friendly tracker (app/api/track) plus
 * the AI lab, career agent and contact form's own records.
 */
export default async function AnalyticsPage(props: { searchParams: Promise<{ days?: string }> }) {
  const searchParams = await props.searchParams;
  const days = RANGES.find((d) => String(d) === searchParams.days) ?? 30;
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("analytics_summary", { days });
  const s = data as Summary | null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-text-dim">How visitors engage with the portfolio.</p>
        </div>
        <nav aria-label="Date range" className="flex rounded-md border border-rule p-0.5 text-sm">
          {RANGES.map((d) => (
            <Link
              key={d}
              href={`/admin/analytics?days=${d}`}
              aria-current={d === days ? "page" : undefined}
              className={`rounded px-3 py-1 ${d === days ? "bg-panel-2 text-text" : "text-text-dim hover:text-text"}`}
            >
              {d} days
            </Link>
          ))}
        </nav>
      </div>

      {error || !s ? (
        <p role="alert" className="mt-6 rounded-md border border-signal-red px-3 py-2 text-sm text-text">
          {adminError("load analytics", error, "Couldn't load analytics. Please reload the page.")}
        </p>
      ) : (
        <>
          <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Visitors" value={s.visitors} hint="Counted once per day" />
            <Stat label="Page views" value={s.pageviews} />
            <Stat label="Pages per visitor" value={s.visitors ? Math.round((s.pageviews / s.visitors) * 10) / 10 : 0} />
            <Stat label="Résumé downloads" value={s.events.resume_download ?? 0} />
            <Stat label="AI lab questions" value={s.ai_questions} />
            <Stat label="Career agent runs" value={s.agent_runs} />
            <Stat label="Contact messages" value={s.contact_messages} />
            <Stat label="Outbound clicks" value={s.events.outbound_click ?? 0} />
          </dl>

          <DailyChart daily={s.daily} />

          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <RankedList
              title="Top pages"
              empty="No page views yet."
              rows={s.pages.map((p) => ({ label: p.path, value: p.pageviews, detail: plural(p.visitors, "visitor") }))}
              unit="view"
            />
            <RankedList
              title="Referrers"
              empty="No visits from other sites yet."
              rows={s.referrers.map((r) => ({ label: r.referrer, value: r.visitors }))}
              unit="visitor"
            />
          </div>

          <p className="mt-10 max-w-prose text-xs text-text-faint">
            No cookies and no personal data: page views are stored with the path, the referring site&apos;s domain and an anonymous
            id that changes every day, so visitors can&apos;t be followed across days. Visitors with Do Not Track or Global Privacy
            Control turned on, bots, and the admin area aren&apos;t counted.
          </p>
        </>
      )}
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border border-rule bg-panel p-4">
      <dt className="text-sm text-text-dim">{label}</dt>
      <dd className="mt-1 font-mono text-2xl font-medium tabular-nums">{nf.format(value)}</dd>
      {hint && <dd className="mt-0.5 text-xs text-text-faint">{hint}</dd>}
    </div>
  );
}

function DailyChart({ daily }: { daily: Summary["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.pageviews));
  return (
    <section aria-labelledby="daily-title" className="mt-10">
      <h2 id="daily-title" className="text-lg">
        Page views per day
      </h2>
      <div aria-hidden className="mt-4 flex h-32 items-end gap-px border-b border-rule">
        {daily.map((d) => (
          <div
            key={d.date}
            title={`${shortDate(d.date)}: ${nf.format(d.pageviews)} views, ${nf.format(d.visitors)} visitors`}
            className="flex-1 rounded-t-sm bg-signal-teal opacity-70 hover:opacity-100"
            style={{ height: `${(d.pageviews / max) * 100}%`, minHeight: d.pageviews ? 2 : 0 }}
          />
        ))}
      </div>
      <div aria-hidden className="mt-1 flex justify-between font-mono text-xs text-text-faint">
        <span>{daily[0] && shortDate(daily[0].date)}</span>
        <span>{daily.at(-1) && shortDate(daily.at(-1)!.date)}</span>
      </div>
      {/* The same numbers for screen readers. */}
      <table className="sr-only">
        <caption>Page views and visitors per day</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Page views</th>
            <th scope="col">Visitors</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((d) => (
            <tr key={d.date}>
              <th scope="row">{shortDate(d.date)}</th>
              <td>{d.pageviews}</td>
              <td>{d.visitors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function RankedList({
  title,
  rows,
  unit,
  empty,
}: {
  title: string;
  rows: { label: string; value: number; detail?: string }[];
  unit: string;
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section>
      <h2 className="text-lg">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-text-faint">{empty}</p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {rows.map((r) => (
            <li key={r.label} className="relative overflow-hidden rounded-md px-3 py-1.5 text-sm">
              <span aria-hidden className="absolute inset-y-0 left-0 bg-panel-2" style={{ width: `${(r.value / max) * 100}%` }} />
              <span className="relative flex items-baseline justify-between gap-4">
                <span className="truncate text-text">{r.label}</span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-text-dim">
                  {plural(r.value, unit)}
                  {r.detail && <span className="text-text-faint"> · {r.detail}</span>}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
