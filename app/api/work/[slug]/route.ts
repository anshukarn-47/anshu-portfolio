import { getPublishedWork, getWorkBySlug } from "@/lib/work";

// Same cached public data as the case study pages.
export const revalidate = 3600;

/** A published case study plus its neighbours, for the expanded card view. */
export async function GET(_request: Request, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  let work: Awaited<ReturnType<typeof getWorkBySlug>>;
  let all: Awaited<ReturnType<typeof getPublishedWork>>;
  try {
    [work, all] = await Promise.all([getWorkBySlug(slug), getPublishedWork()]);
  } catch (err) {
    // The loaders' errors carry database messages: log them, return the site's own wording.
    console.error("[work] could not load case study", err);
    return Response.json({ error: "This case study couldn't be loaded. Please try again." }, { status: 500 });
  }
  if (!work) return Response.json({ error: "Not found" }, { status: 404 });
  const index = all.findIndex((w) => w.slug === work.slug);
  return Response.json({
    work,
    prev: index > 0 ? all[index - 1] : null,
    next: index >= 0 ? all[index + 1] ?? null : null,
  });
}
