-- ─────────────────────────────────────────────────────────────────────────────
-- Boss paneli "Metrikler" sayfası: pazaryeri panel verisi + haftalık teşhis.
--
-- 1) platform-metrics bucket'ı (PRIVATE). Haftalık yayın betiği
--    (tools/platform-collector/publish/weekly_publish.py) service role ile
--    latest/ ve runs/YYYY-MM-DD/ altına CSV + run_log.md yükler; service role
--    RLS'i atladığı için yazma politikası yok. Okuma yalnızca admin
--    (public.is_admin() → admin_allowlist). Anon okuma yok; signed URL
--    üretmek de SELECT yetkisi istediği için yalnız admin üretebilir.
-- 2) metrics_insights: haftalık teşhis kartları (Claude yazar).
-- 3) metrics_actions: aksiyon listesi (panelden düzenlenir).
--    İkisinde de admin okur/yazar; service role RLS'i zaten atlar.
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit)
values ('platform-metrics', 'platform-metrics', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists platform_metrics_admin_read on storage.objects;
create policy platform_metrics_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'platform-metrics' and public.is_admin());

-- ── metrics_insights ────────────────────────────────────────────────────────
create table if not exists public.metrics_insights (
  id          uuid primary key default gen_random_uuid(),
  week_start  date not null,
  severity    text not null check (severity in ('bad', 'warn', 'good')),
  title       text not null,
  body        text,
  metric_code text,
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists metrics_insights_week_idx on public.metrics_insights (week_start desc, sort);

alter table public.metrics_insights enable row level security;
revoke all on table public.metrics_insights from anon;

drop policy if exists metrics_insights_admin_all on public.metrics_insights;
create policy metrics_insights_admin_all on public.metrics_insights
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── metrics_actions ─────────────────────────────────────────────────────────
create table if not exists public.metrics_actions (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  owner       text,
  due_date    date,
  status      text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  metric_code text,
  target      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists metrics_actions_status_idx on public.metrics_actions (status, due_date);

alter table public.metrics_actions enable row level security;
revoke all on table public.metrics_actions from anon;

drop policy if exists metrics_actions_admin_all on public.metrics_actions;
create policy metrics_actions_admin_all on public.metrics_actions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.metrics_actions_touch()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.metrics_actions_touch() from public, anon, authenticated;

drop trigger if exists metrics_actions_touch on public.metrics_actions;
create trigger metrics_actions_touch
  before update on public.metrics_actions
  for each row execute function public.metrics_actions_touch();
