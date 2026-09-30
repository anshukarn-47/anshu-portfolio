-- =============================================================================
-- RAG knowledge base for the AI Lab: source documents, embedded chunks and a
-- similarity-search function.
--
-- Embedding dimension is 1536 (e.g. OpenAI text-embedding-3-small). If you use a
-- different embedding model, change every `vector(1536)` below BEFORE applying.
--
-- Not publicly readable: the server queries these with the service-role client
-- (lib/supabase/admin.ts) and returns only the answer + citations to visitors.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- documents: one row per source (a work case study, a certification, the
-- resume, a free-form note...). `checksum` lets the ingest job skip re-embedding
-- unchanged content.
-- -----------------------------------------------------------------------------
create table public.documents (
  id          uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in (
                'profile', 'work', 'skill', 'certification',
                'achievement', 'prototype', 'resume', 'note'
              )),
  source_id   uuid,                 -- id in the source table; null for resume/notes
  title       text not null,
  content     text not null,
  checksum    text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One document per source row.
create unique index documents_source_uidx
  on public.documents (source_type, source_id)
  where source_id is not null;

create trigger set_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- document_chunks: embedded chunks. Re-ingesting a document = delete its chunks
-- and insert new ones (cascade handles deletes of the whole document).
-- -----------------------------------------------------------------------------
create table public.document_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content     text not null,
  token_count integer,
  embedding   extensions.vector(1536) not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (document_id, chunk_index)
);

-- Approximate nearest-neighbour index for cosine distance.
create index document_chunks_embedding_idx
  on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- -----------------------------------------------------------------------------
-- match_document_chunks: top-k chunks by cosine similarity.
-- Call from the server: supabase.rpc('match_document_chunks', { query_embedding, match_count })
-- -----------------------------------------------------------------------------
create or replace function public.match_document_chunks(
  query_embedding     extensions.vector(1536),
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

-- -----------------------------------------------------------------------------
-- Row Level Security: admins can inspect; everything else goes through the
-- service role.
-- -----------------------------------------------------------------------------
alter table public.documents       enable row level security;
alter table public.document_chunks enable row level security;

create policy "Admins manage documents"
  on public.documents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage document chunks"
  on public.document_chunks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
