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

/** Top chunks for a question, most similar first. */
export async function retrieve(question: string, signal?: AbortSignal): Promise<RetrievedChunk[]> {
  return match(await embedQuery(question, signal), MATCH_COUNT);
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
