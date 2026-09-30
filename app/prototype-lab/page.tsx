import type { Metadata } from "next";
import { getPublishedPrototypes } from "@/lib/prototypes";
import { PROTOTYPES } from "@/lib/prototypes/registry";
import { EmptyState, PageIntro } from "@/components/ui/page-intro";
import { PrototypeGrid, type UpcomingPrototype } from "@/components/prototypes/engine/prototype-grid";
import { ShowcaseCard } from "@/components/prototypes/showcase-card";
import { pageMetadata } from "@/lib/site";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Prototype lab",
    description: "Interactive prototypes, experiments and works in progress.",
    path: "/prototype-lab",
  });
}

// Cached; saving in /admin revalidates immediately. This is a fallback.
export const revalidate = 3600;

/** Announced prototypes, shown as placeholder cards after the finished ones. Remove an entry once it ships. */
const UPCOMING: UpcomingPrototype[] = [{ title: "ServiceNow prototype" }];

export default async function PrototypeLabPage() {
  // Interactive prototypes come from the code registry; demos added in /admin come from the database.
  const showcase = await getPublishedPrototypes();
  const active = showcase.filter((p) => p.stage !== "archived");
  const archived = showcase.filter((p) => p.stage === "archived");

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageIntro title="Prototype lab">
        Interactive prototypes that put you in the product decision, plus experiments and works in progress.
      </PageIntro>

      {PROTOTYPES.length === 0 && showcase.length === 0 ? (
        <EmptyState>Prototypes are on their way.</EmptyState>
      ) : (
        <>
          {(PROTOTYPES.length > 0 || UPCOMING.length > 0) && (
            <div className="mt-10">
              <PrototypeGrid prototypes={PROTOTYPES} upcoming={UPCOMING} />
            </div>
          )}
          {active.length > 0 && (
            <section className="mt-12" aria-labelledby="experiments-title">
              <h2 id="experiments-title" className="text-xl">
                Experiments
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((p) => (
                  <li key={p.id}>
                    <ShowcaseCard prototype={p} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {archived.length > 0 && (
            <section className="mt-12" aria-labelledby="archived-title">
              <h2 id="archived-title" className="text-xl text-text-dim">
                Archived
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {archived.map((p) => (
                  <li key={p.id}>
                    <ShowcaseCard prototype={p} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
