import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMBEDDING_MODEL, embedDocuments } from "@/lib/embeddings/voyage";
import { chunkDocument } from "./chunk";
import { buildPublicDocuments, type SourceDocument } from "./sources";

export type IngestResult = { documents: number; updated: number; unchanged: number; removed: number; chunks: number };

/** Source types owned by this job. Documents of other types (e.g. manual notes) are left alone. */
const MANAGED_TYPES = ["profile", "work", "skill", "certification", "achievement", "prototype"];

const docKey = (d: { source_type: string; source_id: string | null }) =>
  d.source_type === "profile" ? "profile" : `${d.source_type}:${d.source_id}`;

/**
 * Syncs the RAG index with published content: re-embeds changed documents,
 * skips unchanged ones (by checksum) and removes documents whose source is gone
 * or unpublished. All embeddings are computed before any write, so a Voyage
 * failure leaves the existing index untouched.
 */
export async function rebuildIndex(): Promise<IngestResult> {
  const db = createAdminClient();
  const [sources, existingRes] = await Promise.all([
    buildPublicDocuments(),
    db.from("documents").select("id, source_type, source_id, checksum").in("source_type", MANAGED_TYPES),
  ]);
  if (existingRes.error) throw new Error(`Failed to read the index: ${existingRes.error.message}`);

  const existing = new Map((existingRes.data ?? []).map((d) => [docKey(d), d]));
  const checksum = (d: SourceDocument) =>
    createHash("sha256").update(`${EMBEDDING_MODEL}\n${d.title}\n${d.url}\n${d.content}`).digest("hex");

  const changed = sources
    .map((doc) => ({ doc, sum: checksum(doc), chunks: chunkDocument(doc.title, doc.content) }))
    .filter(({ doc, sum }) => existing.get(doc.key)?.checksum !== sum);

  // 1. Embed everything that changed (no writes yet).
  const allChunks = changed.flatMap((c) => c.chunks);
  const vectors = allChunks.length ? await embedDocuments(allChunks) : [];

  // 2. Write documents and their chunks.
  let offset = 0;
  for (const { doc, sum, chunks } of changed) {
    const docVectors = vectors.slice(offset, offset + chunks.length);
    offset += chunks.length;

    const row = {
      source_type: doc.source_type,
      source_id: doc.source_id,
      title: doc.title,
      content: doc.content,
      checksum: null as string | null, // set only after chunks are written
      metadata: { url: doc.url },
    };
    const prior = existing.get(doc.key);
    const saved = prior
      ? await db.from("documents").update(row).eq("id", prior.id).select("id").single()
      : await db.from("documents").insert(row).select("id").single();
    if (saved.error) throw new Error(`Failed to save "${doc.title}": ${saved.error.message}`);
    const documentId = saved.data.id;

    const del = await db.from("document_chunks").delete().eq("document_id", documentId);
    if (del.error) throw new Error(`Failed to clear chunks for "${doc.title}": ${del.error.message}`);
    const ins = await db.from("document_chunks").insert(
      chunks.map((content, i) => ({
        document_id: documentId,
        chunk_index: i,
        content,
        token_count: Math.ceil(content.length / 4), // rough estimate for display only
        embedding: JSON.stringify(docVectors[i]),
        metadata: { url: doc.url },
      }))
    );
    if (ins.error) throw new Error(`Failed to save chunks for "${doc.title}": ${ins.error.message}`);

    // Mark current last, so an interrupted run re-processes this document next time.
    const mark = await db.from("documents").update({ checksum: sum }).eq("id", documentId);
    if (mark.error) throw new Error(`Failed to finalise "${doc.title}": ${mark.error.message}`);
  }

  // 3. Remove documents whose source no longer exists or was unpublished.
  const keep = new Set(sources.map((d) => d.key));
  const stale = (existingRes.data ?? []).filter((d) => !keep.has(docKey(d))).map((d) => d.id);
  if (stale.length) {
    const rm = await db.from("documents").delete().in("id", stale);
    if (rm.error) throw new Error(`Failed to remove stale documents: ${rm.error.message}`);
  }

  return {
    documents: sources.length,
    updated: changed.length,
    unchanged: sources.length - changed.length,
    removed: stale.length,
    chunks: allChunks.length,
  };
}

export async function getIndexStatus() {
  const db = createAdminClient();
  const [docs, chunks, latest] = await Promise.all([
    db.from("documents").select("id", { count: "exact", head: true }),
    db.from("document_chunks").select("id", { count: "exact", head: true }),
    db.from("documents").select("updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    documents: docs.count ?? 0,
    chunks: chunks.count ?? 0,
    lastUpdated: latest.data?.updated_at ?? null,
  };
}
