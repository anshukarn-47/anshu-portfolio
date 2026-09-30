"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { embeddingsConfigured, EmbeddingError } from "@/lib/embeddings/voyage";
import { rebuildIndex } from "@/lib/rag/ingest";

export type RebuildState = { ok: boolean | null; message: string | null };

/** What went wrong, in the site's words: the embedding service's status, never its raw response. */
function rebuildFailure(err: unknown): string {
  if (err instanceof EmbeddingError) {
    if (err.status === 401 || err.status === 403) return "the embedding service rejected the API key. Check VOYAGE_API_KEY.";
    if (err.status === 429) return "the embedding service's rate limit was reached. Wait a minute and try again.";
    if (err.status) return `the embedding service returned an error (HTTP ${err.status}). Try again shortly.`;
    return "the embedding service returned an unexpected response. Try again shortly.";
  }
  return "the index couldn't be read or saved. Try again, and check the server log if it keeps failing.";
}

// Used with useActionState; the previous state isn't needed.
export async function rebuildAiIndex(): Promise<RebuildState> {
  await requireAdmin();
  if (!embeddingsConfigured()) {
    return { ok: false, message: "Add VOYAGE_API_KEY to .env.local and restart the server first." };
  }
  try {
    const r = await rebuildIndex();
    revalidatePath("/admin");
    return {
      ok: true,
      message: `Indexed ${r.documents} documents: ${r.updated} updated (${r.chunks} passages embedded), ${r.unchanged} unchanged, ${r.removed} removed.`,
    };
  } catch (err) {
    // Full details go to the server log; the admin sees the site's own wording.
    console.error("[ai-index] rebuild failed", err);
    return { ok: false, message: `Rebuild failed: ${rebuildFailure(err)}` };
  }
}
