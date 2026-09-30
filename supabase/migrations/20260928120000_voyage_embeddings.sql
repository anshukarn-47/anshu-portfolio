-- =============================================================================
-- Switch RAG embeddings to Voyage AI `voyage-4` (1024 dimensions).
--
-- The original schema sized vectors at 1536. Chunks are derived data (rebuilt by
-- the ingest job from published content), so they are cleared and documents are
-- marked stale; run "Rebuild AI index" in /admin afterwards.
-- =============================================================================

truncate table public.document_chunks;
update public.documents set checksum = null;

-- The HNSW index is rebuilt automatically with the column.
alter table public.document_chunks
  alter column embedding type extensions.vector(1024);

create or replace function public.match_document_chunks(
  query_embedding     extensions.vector(1024),
  match_count         integer default 5,
  min_similarity      double precision default 0,
  filter_source_types text[] default null
)
returns table (
  chunk_id       uuid,
  document_id    uuid,
  document_title text,
  source_type    text,
  source_id      uuid,
  content        text,
  metadata       jsonb,
  similarity     double precision
)
language sql
stable
set search_path = public, extensions
as $$
  select
    c.id,
    c.document_id,
    d.title,
    d.source_type,
    d.source_id,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where (filter_source_types is null or d.source_type = any (filter_source_types))
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 50);
$$;

revoke execute on function public.match_document_chunks from public, anon, authenticated;
grant  execute on function public.match_document_chunks to service_role;
