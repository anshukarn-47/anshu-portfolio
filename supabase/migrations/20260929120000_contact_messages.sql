-- =============================================================================
-- Contact form submissions.
--
-- Each message is emailed to the site owner through Resend (app/api/contact).
-- Rows are kept as a backup in case the email fails, and to rate-limit senders.
-- Visitors never write here directly: the API route inserts with the
-- service-role client after validation, so there are no anon policies.
-- =============================================================================

create table public.contact_messages (
  id           bigint generated always as identity primary key,
  name         text not null check (char_length(name) between 1 and 100),
  email        text not null check (char_length(email) between 3 and 254),
  message      text not null check (char_length(message) between 1 and 5000),
  visitor_id   text,                                  -- anonymous id (salted IP hash), for rate limiting
  email_status text not null default 'pending' check (email_status in ('pending', 'sent', 'failed')),
  created_at   timestamptz not null default now()
);

create index contact_messages_visitor_idx on public.contact_messages (visitor_id, created_at desc);
create index contact_messages_created_idx on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;

create policy "Admins read contact messages"
  on public.contact_messages for select to authenticated using (public.is_admin());
create policy "Admins delete contact messages"
  on public.contact_messages for delete to authenticated using (public.is_admin());
