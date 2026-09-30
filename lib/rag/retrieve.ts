import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedQueries, embedQuery } from "@/lib/embeddings/voyage";

export type RetrievedChunk = {
  chunkId: string;
  title: string;
  url: string | null;
  content: string;
  similarity: number;
};

const MATCH_COUNT = 8;
const MIN_SIMILARITY = 0.25;

/** Pages whose title names something in the question: how many to add, and passages from each. */
const TITLE_MATCH_DOCS = 3;
const TITLE_MATCH_CHUNKS = 2;

/**
 * Chunks for a question: the most similar passages, plus passages from pages
 * whose title names something the question asks about (e.g. "ServiceNow" in
 * "ServiceNow service-management workflow (POC)").
 *
 * Similarity alone misses those pages when a short page matches the wording
 * better: for "What ServiceNow experience does Anshu have?" the ServiceNow
 * case study ranked below unrelated skills. Both passes read the same
 * published index.
 */
export async function retrieve(question: string, signal?: AbortSignal): Promise<RetrievedChunk[]> {
  const [similar, titled] = await Promise.all([embedQuery(question, signal).then((e) => match(e, MATCH_COUNT)), titleMatches(question)]);
  const seen = new Set(similar.map((c) => c.chunkId));
  return [...similar, ...titled.filter((c) => !seen.has(c.chunkId))];
}

/** Words that say nothing about which page is meant. */
const STOPWORDS = new Set(
  (
    "a an the and or but of to in on at by for with from into about as is are was were be been being has have had do does did done " +
    "what which who whom whose when where why how can could would should will shall may might must tell me more any some all most " +
    "his her their them they he she it its this that these those there here your you i my our we us " +
    "experience experienced work worked working works skill skills project projects case study studies portfolio role roles " +
    "product products manager management managing lead led build built use used using know knows knowledge job jobs"
  ).split(" ")
);

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean);

/** Case studies first: they carry the most detail. */
const TYPE_RANK: Record<string, number> = { work: 0, prototype: 1, certification: 2, achievement: 3, skill: 4 };

/**
 * Passages from up to TITLE_MATCH_DOCS pages whose title (without its "Skill: "
 * style prefix) shares a distinctive word with the question. The owner's name
 * is ignored, since every page is about them. Failures only drop this pass.
 */
async function titleMatches(question: string): Promise<RetrievedChunk[]> {
  try {
    const db = createAdminClient();
    const { data: docs, error } = await db.from("documents").select("id, title, source_type");
    if (error || !docs) return [];

    const owner = new Set(words(docs.find((d) => d.source_type === "profile")?.title.replace(/^About\s+/i, "") ?? ""));
    const terms = new Set(words(question).filter((w) => (w.length >= 3 || /^[a-z]{2}$/.test(w)) && !STOPWORDS.has(w) && !owner.has(w)));
    if (!terms.size) return [];

    const matched = docs
      .filter((d) => d.source_type !== "profile")
      .map((d) => ({ ...d, hits: words(d.title.replace(/^[^:]+:\s*/, "")).filter((w) => terms.has(w)).length }))
      .filter((d) => d.hits > 0)
      .sort((a, b) => b.hits - a.hits || (TYPE_RANK[a.source_type] ?? 9) - (TYPE_RANK[b.source_type] ?? 9))
      .slice(0, TITLE_MATCH_DOCS);
    if (!matched.length) return [];

    const { data: chunks, error: chunkError } = await db
      .from("document_chunks")
      .select("id, document_id, chunk_index, content, metadata")
      .in("document_id", matched.map((d) => d.id))
      .lt("chunk_index", TITLE_MATCH_CHUNKS)
      .order("chunk_index");
    if (chunkError || !chunks) return [];

    return matched.flatMap((d) =>
      chunks
        .filter((c) => c.document_id === d.id)
        .map((c) => {
          const meta = c.metadata && typeof c.metadata === "object" && !Array.isArray(c.metadata) ? (c.metadata as Record<string, unknown>) : {};
          const url = meta.url;
          return {
            chunkId: c.id,
            title: d.title,
            url: typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : null,
            content: c.content,
            similarity: 0, // found by title, not by similarity
          };
        })
    );
  } catch (err) {
    console.error("[retrieve] title match failed", err);
    return [];
  }
}

/**
 * Top chunks for several queries (one embedding request), merged round-robin
 * (every query's best match, then every query's second...) with each chunk
 * once, up to `limit`. Round-robin rather than one similarity ranking, so a
 * query with high-scoring matches can't crowd out another query's evidence.
 */
export async function retrieveMany(
  queries: string[],
  perQuery: number,
  limit: number,
  signal?: AbortSignal
): Promise<RetrievedChunk[]> {
  const embeddings = await embedQueries(queries, signal);
  const results = await Promise.all(embeddings.map((e) => match(e, perQuery)));
  const seen = new Set<string>();
  const out: RetrievedChunk[] = [];
  for (let rank = 0; rank < perQuery && out.length < limit; rank++) {
    for (const list of results) {
      const c = list[rank];
      if (!c || seen.has(c.chunkId)) continue;
      seen.add(c.chunkId);
      out.push(c);
      if (out.length >= limit) break;
    }
  }
  return out;
}

async function match(embedding: number[], count: number): Promise<RetrievedChunk[]> {
  const { data, error } = await createAdminClient().rpc("match_document_chunks", {
    query_embedding: JSON.stringify(embedding),
    match_count: count,
    min_similarity: MIN_SIMILARITY,
  });
  if (error) throw new Error(`Search failed: ${error.message}`);

  return (data ?? []).map((row) => {
    const meta = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata : {};
    const url = (meta as Record<string, unknown>).url;
    return {
      chunkId: row.chunk_id,
      title: row.document_title,
      url: typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : null,
      content: row.content,
      similarity: row.similarity,
    };
  });
}

/**
 * One entry per source page, in first-seen order. Used on the chunks Claude
 * actually cited: similarity scores alone can't tell relevant from off-topic
 * (on real content both land around 0.3-0.4), but citations can.
 */
export function uniqueSources(chunks: RetrievedChunk[]): { title: string; url: string | null }[] {
  const seen = new Set<string>();
  const out: { title: string; url: string | null }[] = [];
  for (const c of chunks) {
    const key = c.url ?? c.title;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: c.title, url: c.url });
  }
  return out;
}
