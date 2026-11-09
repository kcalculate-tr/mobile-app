-- G19-S1 md.2 — Tara (AI tarama) herkese açılış sertleştirmesi
-- version: 20261109190100  name: g19_ai_scan_hardening
--
-- DURUM: YALNIZ DOSYA (gece kuralı) — canlıya UYGULANMADI. Geri alma:
--   supabase/rollbacks/20261109190100_g19_ai_scan_hardening_rollback.sql
-- SIRA: bu migration ÖNCE, sonra `analyze-ai-scan` deploy (edge yeni sütunları okur;
-- migration'sız deploy edilirse edge eski davranışa düşer — bkz. edge yorumları).
-- Önkoşul: 20261104000600 (tablolar), 20261104001000 (status 'consumed' CHECK),
--          20261105000200 (reserve_ai_scan sahiplik kontrolü).
--
-- Kapatılan hatalar (G19-S1 uçtan uca denetim):
--  1. TÜKETİLMİŞ anahtarla yeniden rezervasyon hakkı İKİNCİ KEZ düşürüyordu:
--     analiz sunucuda bitti ama yanıt istemciye ulaşmadı (zayıf ağ / arka plan) →
--     istemci "Tekrar dene" ya da kuyruk aynı anahtarla çağırır → eski RPC
--     `on conflict do update set status='reserved'` ile yeniden sayıyordu ve model
--     yeniden çağrılıyordu (çift maliyet). Artık: 'consumed' + kayıtlı sonuç varsa
--     hak DÜŞMEZ ({ok, cached:true}) ve edge sonucu önbellekten döner.
--  2. GECE YARISI: dün ayrılıp bugün analiz edilen anahtar (kuyruk, 23:59 çekim)
--     edge'de 'expired' (409) alıyor, iade ediliyor, ama aynı anahtarla yeniden
--     rezervasyon `day` sütununu GÜNCELLEMEDİĞİ için sonsuza dek 'expired' kalıyordu.
--     Artık yeniden rezervasyon bugünün gününe taşınır; dünden kalan 'reserved'
--     anahtarın dünkü sayacı iade edilir.
--  4. Acil kapatma (İlter 9 Kas): `app_settings.ai_scan_enabled=false` ve genel tavan
--     dolduğunda `reason` döner ('disabled' | 'global_cap') → istemci "Tara şu an
--     kullanılamıyor, kısa süre içinde geri gelecek." (önceden "hakkını kullandın").
--  3. Dakika sınırı için `attempts` + `last_attempt_at` (edge yazar/okur) ve sonuç
--     önbelleği için `result` sütunları.

begin;

alter table public.ai_scan_reservations
  add column if not exists result          jsonb,
  add column if not exists attempts        integer     not null default 0,
  add column if not exists last_attempt_at timestamptz;

comment on column public.ai_scan_reservations.result is
  'G19-S1: başarılı analiz sonucu ({items,total,lang}) — aynı anahtar yeniden istenirse hak düşmeden döner.';
comment on column public.ai_scan_reservations.attempts is
  'G19-S1: bu anahtarla analyze-ai-scan model çağrısı denemesi (edge sınırı).';
comment on column public.ai_scan_reservations.last_attempt_at is
  'G19-S1: son analiz denemesi — kullanıcı başına dakika sınırı (edge).';

create index if not exists ai_scan_reservations_user_attempt_idx
  on public.ai_scan_reservations (user_id, last_attempt_at desc);

create or replace function public.reserve_ai_scan(p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid    := auth.uid();
  v_today      date    := (now() at time zone 'Europe/Istanbul')::date;
  v_reset      timestamptz := ((v_today + 1)::timestamp) at time zone 'Europe/Istanbul';
  v_user_limit integer;
  v_global_cap integer;
  v_used       integer;
  v_global     integer;
  v_owner      uuid;
  v_status     text;
  v_day        date;
  v_has_result boolean;
  v_enabled    boolean;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;
  if coalesce(btrim(p_idempotency_key), '') = '' then
    raise exception 'idempotency_key gerekli';
  end if;

  select coalesce((value::text)::int, 3)
    into v_user_limit from public.app_settings where key = 'ai_scan_user_daily_limit';
  v_user_limit := coalesce(v_user_limit, 3);
  select coalesce((value::text)::int, 1000)
    into v_global_cap from public.app_settings where key = 'ai_scan_daily_cap';
  v_global_cap := coalesce(v_global_cap, 1000);
  -- (4) Acil kapatma anahtarı (İlter 9 Kas): false → {ok:false, reason:'disabled'};
  --     istemci "Tara şu an kullanılamıyor" gösterir ("hakkını kullandın" DEĞİL).
  select coalesce((value #>> '{}')::boolean, true)
    into v_enabled from public.app_settings where key = 'ai_scan_enabled';
  v_enabled := coalesce(v_enabled, true);

  -- Anahtar sahipliği (G10): başkasına aitse reddet. Satır kilitlenir (eşzamanlı
  -- aynı anahtar çağrıları seri).
  select user_id, status, day, (result is not null)
    into v_owner, v_status, v_day, v_has_result
    from public.ai_scan_reservations where idempotency_key = p_idempotency_key
    for update;
  if found and v_owner is distinct from v_uid then
    raise exception 'baskasinin_anahtari' using errcode = '42501';
  end if;

  select coalesce(used, 0) into v_used
    from public.ai_scan_usage where user_id = v_uid and day = v_today;
  v_used := coalesce(v_used, 0);

  -- (1) Tamamlanmış + sonucu kayıtlı: hak DÜŞMEZ, edge önbellekten döner.
  if v_status = 'consumed' and v_has_result then
    return jsonb_build_object('ok', true, 'cached', true,
      'remaining', greatest(0, v_user_limit - v_used), 'reset_at', v_reset);
  end if;

  -- (4) Kapalıyken yeni rezervasyon yok (önbellekli sonuç yukarıda yine döner — maliyet 0).
  if not v_enabled then
    return jsonb_build_object('ok', false, 'reason', 'disabled',
      'remaining', greatest(0, v_user_limit - v_used), 'reset_at', v_reset);
  end if;

  -- Idempotency: bugünün 'reserved' anahtarı tekrar sayılmaz.
  if v_status = 'reserved' and v_day = v_today then
    return jsonb_build_object('ok', true,
      'remaining', greatest(0, v_user_limit - v_used), 'reset_at', v_reset);
  end if;

  -- (2) Dünden kalan 'reserved' anahtar: dünkü sayaç iade edilir, bugüne yeniden ayrılır.
  if v_status = 'reserved' and v_day <> v_today then
    update public.ai_scan_usage set used = greatest(0, used - 1)
     where user_id = v_uid and day = v_day;
    update public.ai_scan_reservations set status = 'released'
     where idempotency_key = p_idempotency_key;
  end if;

  -- Usage satırını oluştur + kilitle (eşzamanlı rezervleri seri hale getirir).
  insert into public.ai_scan_usage (user_id, day, used)
  values (v_uid, v_today, 0)
  on conflict (user_id, day) do nothing;
  select used into v_used
    from public.ai_scan_usage where user_id = v_uid and day = v_today for update;

  if v_used >= v_user_limit then
    return jsonb_build_object('ok', false, 'remaining', 0, 'reset_at', v_reset);
  end if;

  -- Genel günlük tavan (maliyet koruması).
  select coalesce(sum(used), 0) into v_global
    from public.ai_scan_usage where day = v_today;
  if v_global >= v_global_cap then
    -- (4) Genel tavan dolu: kullanıcının KENDİ hakkı bitmedi → 'global_cap' (istemci
    --     "kullanılamıyor" gösterir; önceden "Bugünkü 3 taramanı kullandın" diyordu).
    return jsonb_build_object('ok', false, 'reason', 'global_cap',
      'remaining', greatest(0, v_user_limit - v_used), 'reset_at', v_reset);
  end if;

  update public.ai_scan_usage set used = used + 1
   where user_id = v_uid and day = v_today;

  -- (2) `day` da güncellenir (gece yarısını geçen anahtar bugüne taşınır); eski
  -- sonuç (sonuçsuz 'consumed' satırı — migration öncesi) temizlenir.
  insert into public.ai_scan_reservations (idempotency_key, user_id, day, status)
  values (p_idempotency_key, v_uid, v_today, 'reserved')
  on conflict (idempotency_key) do update
    set status = 'reserved', day = excluded.day, result = null;

  return jsonb_build_object('ok', true,
    'remaining', greatest(0, v_user_limit - (v_used + 1)), 'reset_at', v_reset);
end;
$$;

revoke all on function public.reserve_ai_scan(text) from public, anon;
grant execute on function public.reserve_ai_scan(text) to authenticated;

-- Dakika sınırı / deneme ayarları (edge okur; yoksa edge varsayılanı).
insert into public.app_settings (key, value, description) values
  ('ai_scan_per_minute',       '4'::jsonb, 'G19-S1: kullanıcı başına dakikada en fazla farklı tarama (analyze-ai-scan, 429 rate_limit).'),
  ('ai_scan_enabled',          'true'::jsonb, 'G19-S1: acil kapatma anahtarı. false → reserve_ai_scan {ok:false, reason:disabled}; istemci "Tara şu an kullanılamıyor".'),
  ('ai_scan_max_key_attempts', '4'::jsonb, 'G19-S1: aynı tarama anahtarıyla en fazla model çağrısı (analyze-ai-scan, 429 rate_limit).')
on conflict (key) do nothing;

-- G19-S1 md.6 — Tara olayları D-S1 sözlüğüne (night19/data, 20261109100300_d_s1_kpi).
-- Sözlük tablosu yoksa (D-S1 henüz uygulanmadı) sessizce atlanır; D-S1 sonrası
-- bu migration yeniden çalıştırılabilir (idempotent).
do $$
begin
  if to_regclass('public.analytics_event_names') is not null then
    insert into public.analytics_event_names
      (name, category, source, description_tr, description_en, props_hint, alias_of, is_kpi)
    values
      ('scan_open',  'tracking', 'client', 'Tara ekranı açıldı', 'Scan screen opened', 'camera: live|fallback', null, false),
      ('scan_limit', 'tracking', 'client', 'Günlük ücretsiz tarama hakkı bitti (FinErrLimit)', 'Daily free scans used up (FinErrLimit)', null, null, false)
    on conflict (name) do nothing;
    update public.analytics_event_names
       set props_hint = 'source: camera|gallery, has_note, retry, offline'
     where name = 'scan_start' and props_hint is null;
    update public.analytics_event_names
       set props_hint = 'n_items, kcal, cached'
     where name = 'scan_success' and props_hint = 'kcal';
    update public.analytics_event_names
       set props_hint = 'reason (edge/istemci kodu), stage'
     where name = 'scan_failed' and props_hint = 'reason';
  end if;
end $$;

commit;
