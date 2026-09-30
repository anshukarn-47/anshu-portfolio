-- =============================================================================
-- Extensions, shared helpers and admin access
-- =============================================================================

-- pgvector for RAG embeddings (installed into the `extensions` schema per Supabase convention).
create extension if not exists vector with schema extensions;

-- Keeps `updated_at` current on every UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Admin users: auth users allowed to manage content from /admin.
-- Add yourself after signing up (run in the SQL editor):
--   insert into public.admin_users (user_id)
--   select id from auth.users where email = 'you@example.com';
-- -----------------------------------------------------------------------------
create table public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- SECURITY DEFINER so RLS policies can call it without recursing into admin_users' own RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

create policy "Admins can read admin list"
  on public.admin_users for select
  to authenticated
  using (public.is_admin());
-- No insert/update/delete policies: admins are managed via SQL editor or service role only.
