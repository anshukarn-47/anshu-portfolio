import "server-only";

/**
 * Voyage AI embeddings over its HTTP API (no official TypeScript SDK).
 * Docs: https://docs.voyageai.com/reference/embeddings-api
 *
 * The model and dimension must match the `vector(1024)` column in
 * supabase/migrations/20260928120000_voyage_embeddings.sql.
 */
export const EMBEDDING_MODEL = "voyage-4";
export const EMBEDDING_DIMENSIONS = 1024;

const ENDPOINT = "https://api.voyageai.com/v1/embeddings";
const BATCH_SIZE = 64; // well under the API's 1,000 texts / 320K tokens per request

type VoyageResponse = {
  data: { embedding: number[]; index: number }[];
  usage: { total_tokens: number };
};

export class EmbeddingError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "EmbeddingError";
  }
}

export function embeddingsConfigured(): boolean {
  return !!process.env.VOYAGE_API_KEY;
}

async function embed(texts: string[], inputType: "document" | "query", signal?: AbortSignal): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new EmbeddingError("VOYAGE_API_KEY is not set.");

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        input: batch,
        model: EMBEDDING_MODEL,
        input_type: inputType,
        output_dimension: EMBEDDING_DIMENSIONS,
      }),
      cache: "no-store",
      signal,
    });
    if (!res.ok) {
      // Voyage error bodies are JSON with a `detail` field; never include the key.
      const detail = await res.json().then((b: { detail?: string }) => b.detail).catch(() => undefined);
      throw new EmbeddingError(`Voyage embeddings failed (${res.status})${detail ? `: ${detail}` : ""}`, res.status);
    }
    const body = (await res.json()) as VoyageResponse;
    const sorted = [...body.data].sort((a, b) => a.index - b.index);
    if (sorted.length !== batch.length || sorted.some((d) => d.embedding.length !== EMBEDDING_DIMENSIONS)) {
      throw new EmbeddingError("Voyage returned an unexpected number or size of embeddings.");
    }
    out.push(...sorted.map((d) => d.embedding));
  }
  return out;
}

/** Embeddings for content being indexed. */
export function embedDocuments(texts: string[]): Promise<number[][]> {
  return embed(texts, "document");
}

/** Embedding for a search question. */
export async function embedQuery(text: string, signal?: AbortSignal): Promise<number[]> {
  const [vector] = await embed([text], "query", signal);
  return vector;
}

/** Embeddings for several search queries in one request (Voyage limits requests per minute). */
export function embedQueries(texts: string[], signal?: AbortSignal): Promise<number[][]> {
  return embed(texts, "query", signal);
}
