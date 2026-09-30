-- =============================================================================
-- Portfolio content: profile, work, skills, certifications, achievements,
-- prototypes, plus work_skills / certification_skills join tables.
--
-- Public visibility (RLS):
--   profile        always
--   work           published = true
--   skills         always
--   certifications status <> 'hidden'
--   achievements   always
--   prototypes     published = true
-- Admins (public.is_admin()) can read and write everything.
-- The service role (server-side seeding / admin API routes) bypasses RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profile: single-row table backing the home and /about pages.
-- -----------------------------------------------------------------------------
create table public.profile (
  id           smallint primary key default 1 check (id = 1),
  full_name    text not null,
  headline     text,
  bio          text,                -- markdown
  location     text,
  email        text,
  avatar_url   text,
  resume_url   text,                -- e.g. /resume/anshu-resume.pdf
  social_links jsonb not null default '{}'::jsonb,  -- { "github": "...", "linkedin": "..." }
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- work: case studies for /work.
--
-- Structured sections are JSONB (always read/edited as a whole with the case study):
--   decisions    [{ "title": "...", "context": "...", "choice": "...", "tradeoffs": "..." }]
--   metrics      [{ "label": "...", "value": 42, "unit": "%", "context": "..." }]
--   architecture { "summary": "...", "diagram_url": "/images/...", "components": [{ "name": "...", "description": "..." }] }
-- -----------------------------------------------------------------------------
create table public.work (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title         text not null,
  subtitle      text,
  category      text,               -- e.g. 'Product Design', 'AI', 'Platform'
  company       text,
  year          smallint check (year between 1990 and 2100),
  summary       text,
  problem       text,               -- markdown
  users         text,               -- who the work was for (markdown)
  role          text,
  approach      text,               -- markdown
  decisions     jsonb not null default '[]'::jsonb check (jsonb_typeof(decisions) = 'array'),
  outcome       text,               -- markdown
  metrics       jsonb not null default '[]'::jsonb check (jsonb_typeof(metrics) = 'array'),
  architecture  jsonb not null default '{}'::jsonb check (jsonb_typeof(architecture) = 'object'),
  featured      boolean not null default false,
  published     boolean not null default false,
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index work_listing_idx on public.work (published, display_order);

-- -----------------------------------------------------------------------------
-- skills: /skills.
-- -----------------------------------------------------------------------------
create table public.skills (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category      text not null,      -- e.g. 'Languages', 'Frameworks', 'AI / ML', 'Cloud'
  description   text,
  icon          text,               -- icon name or /images/... path
  featured      boolean not null default false,
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index skills_listing_idx on public.skills (category, display_order);

-- -----------------------------------------------------------------------------
-- certifications: /certifications.
--   status: active | expired | hidden (hidden = not shown publicly)
-- -----------------------------------------------------------------------------
create table public.certifications (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  issuer                text not null,
  description           text,
  issue_date            date,
  expiry_date           date,       -- null = does not expire
  credential_id         text,
  credential_url        text,       -- issuer verification link
  certificate_image_url text,       -- e.g. /certificates/aws-saa.png
  featured              boolean not null default false,
  display_order         integer not null default 0,
  status                text not null default 'active'
                        check (status in ('active', 'expired', 'hidden')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint certifications_dates_check
    check (issue_date is null or expiry_date is null or expiry_date >= issue_date)
);

create index certifications_listing_idx on public.certifications (status, display_order);

-- -----------------------------------------------------------------------------
-- achievements: /achievements. Optionally tied to a work item.
--   e.g. metric_value 40, metric_unit '%', metric_context 'reduction in onboarding time'
-- -----------------------------------------------------------------------------
create table public.achievements (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  metric_value   numeric,
  metric_unit    text,
  metric_context text,
  category       text,              -- e.g. 'Impact', 'Award', 'Hackathon', 'Publication'
  date           date,
  work_id        uuid references public.work (id) on delete set null,
  featured       boolean not null default false,
  display_order  integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index achievements_listing_idx on public.achievements (display_order, date desc);
create index achievements_work_idx on public.achievements (work_id);

-- -----------------------------------------------------------------------------
-- prototypes: /prototype-lab.
-- -----------------------------------------------------------------------------
create table public.prototypes (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title         text not null,
  summary       text,
  description   text,               -- markdown
  stage         text not null default 'concept'
                check (stage in ('concept', 'in_progress', 'live', 'archived')),
  tech_stack    text[] not null default '{}',
  demo_url      text,
  repo_url      text,
  embed_url     text,               -- for iframe-embeddable demos
  thumbnail_url text,
  featured      boolean not null default false,
  published     boolean not null default false,
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index prototypes_listing_idx on public.prototypes (published, display_order);

-- -----------------------------------------------------------------------------
-- Join tables: which skills a work item / certification demonstrates.
-- -----------------------------------------------------------------------------
create table public.work_skills (
  work_id  uuid not null references public.work (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  primary key (work_id, skill_id)
);

create index work_skills_skill_idx on public.work_skills (skill_id);

create table public.certification_skills (
  certification_id uuid not null references public.certifications (id) on delete cascade,
  skill_id         uuid not null references public.skills (id) on delete cascade,
  primary key (certification_id, skill_id)
);

create index certification_skills_skill_idx on public.certification_skills (skill_id);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on public.profile
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.work
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.skills
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.certifications
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.achievements
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.prototypes
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profile              enable row level security;
alter table public.work                 enable row level security;
alter table public.skills               enable row level security;
alter table public.certifications       enable row level security;
alter table public.achievements         enable row level security;
alter table public.prototypes           enable row level security;
alter table public.work_skills          enable row level security;
alter table public.certification_skills enable row level security;

create policy "Public can read profile"
  on public.profile for select to anon, authenticated using (true);
create policy "Admins manage profile"
  on public.profile for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Public can read published work"
  on public.work for select to anon, authenticated using (published);
create policy "Admins manage work"
  on public.work for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Public can read skills"
  on public.skills for select to anon, authenticated using (true);
create policy "Admins manage skills"
  on public.skills for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Public can read visible certifications"
  on public.certifications for select to anon, authenticated using (status <> 'hidden');
create policy "Admins manage certifications"
  on public.certifications for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Public can read achievements"
  on public.achievements for select to anon, authenticated using (true);
create policy "Admins manage achievements"
  on public.achievements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Public can read published prototypes"
  on public.prototypes for select to anon, authenticated using (published);
create policy "Admins manage prototypes"
  on public.prototypes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Join rows are visible when the parent row is visible (the subquery is subject to its RLS).
create policy "Public can read work skills"
  on public.work_skills for select to anon, authenticated
  using (exists (select 1 from public.work w where w.id = work_id));
create policy "Admins manage work skills"
  on public.work_skills for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Public can read certification skills"
  on public.certification_skills for select to anon, authenticated
  using (exists (select 1 from public.certifications c where c.id = certification_id));
create policy "Admins manage certification skills"
  on public.certification_skills for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
