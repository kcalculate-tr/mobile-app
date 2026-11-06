-- G15-S2 — Su takibi (Ana sayfa Su halkası, FinHomeR3).
-- version: 20261106000100  name: g15_water
--
-- DURUM: Bu dosya YALNIZCA yazıldı; canlıya/staging'e UYGULANMADI (gece kuralı).
-- Geri alma: supabase/rollbacks/20261106000100_g15_water_rollback.sql
-- G6-APPLY sırası: #18 (20261105000400_g12_flags.sql'den SONRA).
--
-- İçerik:
--  1) public.water_daily — kullanıcı başına GÜNLÜK tek satır (ml). Gün
--     Europe/Istanbul takvimine göre (uygulamanın "bugün"ü ile aynı).
--     RLS: yalnız sahibi okur/yazar. Silme yok (geri alma = negatif log).
--  2) public.log_water(p_ml int) → int: bugünün toplamına p_ml ekler
--     (negatif = geri al), toplam 0'ın altına inmez, 20 L üstüne çıkmaz.
--     Yeni toplamı döner. security invoker → RLS geçerli.
--  3) feature_flags satırı 'su_takibi' — KAPALI (enabled=false,
--     rollout_percent=0, min_app_version='1.1.0'). İstemci: registry.ts
--     FLAG_DEFAULTS.su_takibi=false. Kapalıyken uygulama bugünküyle AYNI
--     (water_daily'ye hiç istek atılmaz).
--
-- Geriye uyumlu: yeni tablo + yeni fonksiyon + yeni bayrak satırı; mevcut
-- hiçbir tablo/kolon değişmez.

begin;

create table if not exists public.water_daily (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null,
  ml         integer not null default 0 check (ml >= 0 and ml <= 20000),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

comment on table public.water_daily is
  'G15 — kullanıcı başına günlük su toplamı (ml). Gün Europe/Istanbul. Yazma yalnız log_water() ile.';

alter table public.water_daily enable row level security;

drop policy if exists water_daily_owner_select on public.water_daily;
create policy water_daily_owner_select on public.water_daily
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists water_daily_owner_insert on public.water_daily;
create policy water_daily_owner_insert on public.water_daily
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists water_daily_owner_update on public.water_daily;
create policy water_daily_owner_update on public.water_daily
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- anon hiçbir şey göremez; authenticated yalnız kendi satırı (RLS).
revoke all on public.water_daily from anon;
grant select, insert, update on public.water_daily to authenticated;

create or replace function public.log_water(p_ml integer)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_day   date := (now() at time zone 'Europe/Istanbul')::date;
  v_total integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_ml is null or p_ml = 0 or abs(p_ml) > 2000 then
    raise exception 'invalid_ml' using errcode = '22023';
  end if;

  insert into public.water_daily as w (user_id, day, ml, updated_at)
  values (v_uid, v_day, least(greatest(p_ml, 0), 20000), now())
  on conflict (user_id, day) do update
    set ml = least(greatest(w.ml + p_ml, 0), 20000),
        updated_at = now()
  returning w.ml into v_total;

  return v_total;
end;
$$;

comment on function public.log_water(integer) is
  'G15 — bugünün (Europe/Istanbul) su toplamına p_ml ekler (negatif = geri al); yeni toplamı döner. RLS: yalnız sahibi.';

revoke all on function public.log_water(integer) from public, anon;
grant execute on function public.log_water(integer) to authenticated;

insert into public.feature_flags (key, enabled, rollout_percent, min_app_version, description)
values (
  'su_takibi', false, 0, '1.1.0',
  'Ana sayfa Su halkası + hızlı su ekleme (G15-S2, water_daily + log_water). Kapalıyken uygulama 1.0.7 ile aynı; 1.1.0+ gerekir.'
)
on conflict (key) do nothing;

commit;
