-- =============================================================================
-- Privacy-friendly analytics: summary for /admin/analytics.
--
-- analytics_events rows are written by app/api/track with no cookies and no raw
-- IP addresses: visitor_id is a keyed hash of (day, IP, user agent) that changes
-- every day, so a visitor is counted once per day and can't be followed across
-- days. user_agent and session_id are left empty.
--
-- security invoker: runs with the caller's rights, so RLS applies and only
-- admins see real numbers (anyone else reads empty tables and gets zeros).
-- =============================================================================

create or replace function public.analytics_summary(days integer default 30)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select (current_date - (greatest(least(days, 365), 1) - 1))::timestamptz as since
  ),
  views as (
    select e.* from public.analytics_events e, bounds b
    where e.event_name = 'pageview' and e.created_at >= b.since
  )
  select jsonb_build_object(
    'since', (select since from bounds),
    'pageviews', (select count(*) from views),
    -- Daily hashes: summing each day's unique visitors ("visitor-days").
    'visitors', (select count(distinct (v.created_at::date, v.visitor_id)) from views v),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d.day, 'pageviews', coalesce(x.pageviews, 0), 'visitors', coalesce(x.visitors, 0)) order by d.day), '[]'::jsonb)
      from bounds b
      cross join lateral generate_series(b.since::date, current_date, interval '1 day') as d(day)
      left join (
        select created_at::date as day, count(*) as pageviews, count(distinct visitor_id) as visitors
        from views group by 1
      ) x on x.day = d.day::date
    ),
    'pages', (
      select coalesce(jsonb_agg(p order by p.pageviews desc, p.path), '[]'::jsonb) from (
        select path, count(*) as pageviews, count(distinct (created_at::date, visitor_id)) as visitors
        from views group by path order by 2 desc, 1 limit 10
      ) p
    ),
    'referrers', (
      select coalesce(jsonb_agg(r order by r.visitors desc, r.referrer), '[]'::jsonb) from (
        select referrer, count(distinct (created_at::date, visitor_id)) as visitors
        from views where referrer is not null group by referrer order by 2 desc, 1 limit 10
      ) r
    ),
    'events', (
      select coalesce(jsonb_object_agg(event_name, n), '{}'::jsonb) from (
        select e.event_name, count(*) as n from public.analytics_events e, bounds b
        where e.event_name <> 'pageview' and e.created_at >= b.since group by 1
      ) ev
    ),
    'ai_questions', (
      select count(*) from public.chat_messages m join public.chat_sessions s on s.id = m.session_id, bounds b
      where m.role = 'user' and s.channel = 'rag' and m.created_at >= b.since
    ),
    'agent_runs', (
      select count(*) from public.chat_messages m join public.chat_sessions s on s.id = m.session_id, bounds b
      where m.role = 'user' and s.channel = 'agent' and m.created_at >= b.since
    ),
    'contact_messages', (
      select count(*) from public.contact_messages c, bounds b where c.created_at >= b.since
    )
  );
$$;

revoke execute on function public.analytics_summary(integer) from public, anon;
grant execute on function public.analytics_summary(integer) to authenticated;

-- Page views are read by day; keep the lookup cheap.
create index if not exists analytics_events_pageview_idx
  on public.analytics_events (created_at desc) where event_name = 'pageview';
