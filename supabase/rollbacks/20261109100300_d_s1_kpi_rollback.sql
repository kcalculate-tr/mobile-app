-- D-S1 — 20261109100300_d_s1_kpi.sql geri alma. UYGULANMADI (yalnız dosya).
-- analytics_events politikası 20260916094149'daki ilk hâline döner; olay verisi SİLİNMEZ.
begin;
drop function if exists public.admin_kpi(date, date, uuid);
drop view if exists public.kpi_daily_orders;
drop view if exists public.kpi_orders_unified;
drop view if exists public.kpi_unknown_event_names;
delete from public.app_settings where key = 'kpi_targets';

drop trigger if exists analytics_events_sanitize on public.analytics_events;
drop function if exists public.analytics_events_sanitize();
drop policy if exists analytics_events_insert_own on public.analytics_events;
drop policy if exists "insert own events" on public.analytics_events;
create policy "insert own events" on public.analytics_events
  for insert with check (user_id is null or user_id = auth.uid());
-- Supabase varsayılanı (public tablolarda anon/authenticated'e tüm yetki) — eski hâl.
grant all on public.analytics_events to anon, authenticated;
drop index if exists public.analytics_events_created_at_idx;
drop index if exists public.analytics_events_session_idx;
drop index if exists public.analytics_events_anon_idx;

drop table if exists public.analytics_event_names;
commit;
