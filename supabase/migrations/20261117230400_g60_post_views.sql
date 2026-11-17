-- G60-S1 md.3 — Ölçüm: Keşfet kart görüntülenmeleri `post_views` + toplu upsert RPC `record_post_views`.
-- version: 20261117230400  name: g60_post_views
--
-- DURUM: YALNIZ DOSYA. Canlıya uygulanmadı. Geri alma:
--   supabase/rollbacks/20261117230400_g60_post_views_rollback.sql
-- Önkoşul: posts (G5), feed_flag_enabled (G8), kesfet_siralama bayrağı (230300).
--
-- Neden ayrı hafif tablo: analytics_events hacmini şişirmemek için. Satır = (gönderi, kullanıcı)
-- başına TEK satır; tekrar görüntüleme yalnız sayaç/süre günceller.
-- İstemci: kart ekranda ≥ 1 sn görününce, oturum başına aynı gönderi bir kez, 10'luk paket ya da
-- 30 sn'de bir gönderir (src/modules/kesfet/impressions.ts). Yalnız `kesfet_siralama` açıkken.
-- KVKK: kişiye özel; yalnız sıralama için. İstemci okuyamaz (RLS açık, politika yok).
-- Bu turda puana GİRMEZ (yalnız toplanır).
-- İdempotent.
begin;

create table if not exists public.post_views (
  post_id       uuid        not null references public.posts (id) on delete cascade,
  user_id       uuid        not null references auth.users (id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  dwell_ms      bigint      not null default 0 check (dwell_ms >= 0),
  seen_count    integer     not null default 1 check (seen_count >= 1),
  primary key (post_id, user_id)
);

comment on table public.post_views is
  'G60-S1: Keşfet görüntülenmeleri (≥1 sn, oturumda bir kez). Kişiye özel; yalnız sıralama için. İstemci okumaz.';

create index if not exists post_views_user_idx on public.post_views (user_id, last_seen_at desc);

alter table public.post_views enable row level security;
revoke all on table public.post_views from anon, authenticated;

-- p_items: [{ "post_id": uuid, "dwell_ms": int }, …] — en çok 50 öğe; bozuk öğe atlanır.
-- Dönüş: { "ok": true, "n": kaydedilen }. Bayrak kapalı → { "ok": false, "n": 0 } (hata değil).
create or replace function public.record_post_views(p_items jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_n   int  := 0;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if not public.feed_flag_enabled('kesfet_siralama') then
    return jsonb_build_object('ok', false, 'n', 0);
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'gecersiz_girdi'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'cok_fazla' using errcode = '22023'; end if;

  with raw as (
    select (e ->> 'post_id') as pid_txt, (e ->> 'dwell_ms') as dw_txt
      from jsonb_array_elements(p_items) e
     where jsonb_typeof(e) = 'object'
  ),
  parsed as (
    select pid_txt::uuid as post_id,
           least(greatest(coalesce(nullif(dw_txt, '')::numeric, 0), 0), 600000)::bigint as dwell_ms
      from raw
     where pid_txt ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       and (dw_txt is null or dw_txt ~ '^[0-9]{1,9}(\.[0-9]+)?$')
  ),
  agg as (
    select post_id, sum(dwell_ms)::bigint as dwell_ms from parsed group by post_id
  ),
  ok as (   -- yalnız görülebilir gönderiler (gizlilik süzgeci get_feed ile aynı)
    select a.* from agg a
      join public.posts p on p.id = a.post_id
     where p.status = 'published'
       and public.feed_can_view_author(v_uid, p.author_id)
  ),
  ins as (
    insert into public.post_views as v (post_id, user_id, first_seen_at, last_seen_at, dwell_ms, seen_count)
    select ok.post_id, v_uid, now(), now(), ok.dwell_ms, 1 from ok
    on conflict (post_id, user_id) do update
      set last_seen_at = now(),
          dwell_ms     = least(v.dwell_ms + excluded.dwell_ms, 86400000),
          seen_count   = v.seen_count + 1
    returning 1
  )
  select count(*)::int into v_n from ins;

  return jsonb_build_object('ok', true, 'n', v_n);
end;
$$;

revoke all on function public.record_post_views(jsonb) from public, anon;
grant execute on function public.record_post_views(jsonb) to authenticated;

commit;
