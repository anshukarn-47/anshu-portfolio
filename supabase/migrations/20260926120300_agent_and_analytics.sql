-- =============================================================================
-- Agent / RAG chat history and site analytics.
--
-- Visitors never write to these tables directly: API routes (app/api/...) insert
-- rows with the service-role client after validation and rate limiting, so there
-- are no anon policies. Admins can read everything from /admin.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- chat_sessions / chat_messages
-- -----------------------------------------------------------------------------
create table public.chat_sessions (
  id              uuid primary key default gen_random_uuid(),
  visitor_id      text,             -- anonymous id from a first-party cookie
  channel         text not null default 'rag' check (channel in ('rag', 'agent')),
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index chat_sessions_recent_idx on public.chat_sessions (last_message_at desc);

create table public.chat_messages (
  id            bigint generated always as identity primary key,
  session_id    uuid not null references public.chat_sessions (id) on delete cascade,
  role          text not null check (role in ('user', 'assistant', 'tool')),
  content       text not null,
  sources       jsonb not null default '[]'::jsonb,  -- cited chunks: [{ chunk_id, document_title, similarity }]
  tool_calls    jsonb,                               -- agent tool invocations, if any
  model         text,
  input_tokens  integer,
  output_tokens integer,
  latency_ms    integer,
  created_at    timestamptz not null default now()
);

create index chat_messages_session_idx on public.chat_messages (session_id, created_at);

-- Bump the session's last_message_at whenever a message is added.
create or replace function public.touch_chat_session()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.chat_sessions
     set last_message_at = new.created_at
   where id = new.session_id;
  return new;
end;
$$;

create trigger touch_chat_session after insert on public.chat_messages
  for each row execute function public.touch_chat_session();

-- -----------------------------------------------------------------------------
-- analytics_events: page views and custom events (resume downloads, demo opens,
-- chat started...).
-- -----------------------------------------------------------------------------
create table public.analytics_events (
  id         bigint generated always as identity primary key,
  event_name text not null check (char_length(event_name) between 1 and 100),
  path       text,
  referrer   text,
  visitor_id text,
  session_id text,
  properties jsonb not null default '{}'::jsonb,
  user_agent text,
  country    text,
  created_at timestamptz not null default now()
);

create index analytics_events_created_idx on public.analytics_events (created_at desc);
create index analytics_events_name_idx    on public.analytics_events (event_name, created_at desc);
create index analytics_events_path_idx    on public.analytics_events (path, created_at desc);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.chat_sessions    enable row level security;
alter table public.chat_messages    enable row level security;
alter table public.analytics_events enable row level security;

create policy "Admins read chat sessions"
  on public.chat_sessions for select to authenticated using (public.is_admin());
create policy "Admins delete chat sessions"
  on public.chat_sessions for delete to authenticated using (public.is_admin());

create policy "Admins read chat messages"
  on public.chat_messages for select to authenticated using (public.is_admin());

create policy "Admins read analytics events"
  on public.analytics_events for select to authenticated using (public.is_admin());
create policy "Admins delete analytics events"
  on public.analytics_events for delete to authenticated using (public.is_admin());
