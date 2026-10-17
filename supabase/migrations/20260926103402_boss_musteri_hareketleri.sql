-- ─────────────────────────────────────────────────────────────────────────────
-- MÜŞTERİ HAREKETLERİ — boss panel için iki okuma fonksiyonu.
--
-- 26.09.2026: "kimler kartını kaydetmiş, müşterinin tüm hareketlerini görelim".
-- Mevcut boss_customers fonksiyonuna DOKUNULMADI (çalışan, allowlist korumalı,
-- sayfalamalı bir fonksiyon; dönüş tipini değiştirmek onu düşürüp yeniden
-- yaratmayı gerektirirdi). Bunun yerine panel görünen sayfanın kullanıcı
-- kimliklerini ikinci bir çağrıyla zenginleştiriyor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Üst bandın KPI'ları
create or replace function public.boss_activity_summary()
returns table (
  toplam_kullanici        bigint,
  kayitli_kart            bigint,
  kart_kaydeden_kisi      bigint,
  kart_kaydeden_oran      numeric,
  giris_email             bigint,
  giris_google            bigint,
  giris_apple             bigint,
  siparis_kayitli_kart    bigint,
  siparis_yeni_kart       bigint,
  siparis_yontemsiz       bigint,
  adresi_olan_kisi        bigint,
  siparis_veren_kisi      bigint,
  kuponlu_siparis         bigint
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (
    select 1 from admin_allowlist a
    where a.user_id = auth.uid()
       or (a.email is not null and a.email = (auth.jwt() ->> 'email'))
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from auth.users),
    (select count(*) from user_cards),
    (select count(distinct uc.user_id) from user_cards uc),
    case when (select count(*) from auth.users) > 0
         then round(100.0 * (select count(distinct uc.user_id) from user_cards uc)
                          / (select count(*) from auth.users), 2)
         else 0 end,
    (select count(*) from auth.users u where coalesce(u.raw_app_meta_data->>'provider','email') = 'email'),
    (select count(*) from auth.users u where u.raw_app_meta_data->>'provider' = 'google'),
    (select count(*) from auth.users u where u.raw_app_meta_data->>'provider' = 'apple'),
    (select count(*) from orders o where o.payment_method = 'saved_card'),
    (select count(*) from orders o where o.payment_method = 'new_card'),
    (select count(*) from orders o where o.payment_method is null),
    (select count(distinct a.user_id) from addresses a where a.user_id is not null),
    (select count(distinct o.user_id) from orders o where o.user_id is not null),
    (select count(*) from orders o where nullif(o.coupon_code,'') is not null);
end;
$$;

-- 2) Görünen müşterilerin hareket detayı
create or replace function public.boss_customer_activity(p_user_ids uuid[])
returns table (
  user_id             uuid,
  auth_provider       text,
  email_gizli         boolean,
  kayitli_kart        bigint,
  kart_bankalari      text,
  ilk_kart_at         timestamptz,
  adres_sayisi        integer,
  siparis_kayitli_kart bigint,
  siparis_yeni_kart   bigint,
  kuponlu_siparis     bigint,
  kullanilan_kuponlar text,
  degerlendirme       bigint,
  ilk_siparis_at      timestamptz,
  son_giris_at        timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (
    select 1 from admin_allowlist a
    where a.user_id = auth.uid()
       or (a.email is not null and a.email = (auth.jwt() ->> 'email'))
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    u.id,
    coalesce(u.raw_app_meta_data->>'provider', 'email')::text,
    -- Apple "E-postamı Gizle": gerçek adres bize HİÇ verilmiyor, elimizdeki
    -- yönlendirme adresi. Panelde ayırt edilebilsin diye işaretleniyor.
    (u.email ilike '%privaterelay.appleid.com')::boolean,
    coalesce(k.adet, 0),
    k.bankalar,
    k.ilk_kart,
    coalesce(ad.adet, 0),
    coalesce(o.kayitli_kart, 0),
    coalesce(o.yeni_kart, 0),
    coalesce(o.kuponlu, 0),
    o.kuponlar,
    coalesce(r.adet, 0),
    o.ilk_siparis,
    u.last_sign_in_at
  from auth.users u
  left join lateral (
    select count(*) as adet,
           string_agg(distinct coalesce(c.bank_name, c.brand), ', ') as bankalar,
           min(c.created_at) as ilk_kart
    from user_cards c where c.user_id = u.id
  ) k on true
  left join lateral (
    select count(*)::int as adet from addresses a where a.user_id = u.id
  ) ad on true
  left join lateral (
    select count(*) filter (where x.payment_method = 'saved_card') as kayitli_kart,
           count(*) filter (where x.payment_method = 'new_card')   as yeni_kart,
           count(*) filter (where nullif(x.coupon_code,'') is not null) as kuponlu,
           string_agg(distinct nullif(x.coupon_code,''), ', ')      as kuponlar,
           min(x.created_at)                                        as ilk_siparis
    from orders x where x.user_id = u.id
  ) o on true
  left join lateral (
    select count(*) as adet from reviews rv where rv.user_id = u.id
  ) r on true
  where u.id = any(p_user_ids);
end;
$$;

revoke all on function public.boss_activity_summary() from public, anon;
revoke all on function public.boss_customer_activity(uuid[]) from public, anon;
grant execute on function public.boss_activity_summary() to authenticated;
grant execute on function public.boss_customer_activity(uuid[]) to authenticated;;
