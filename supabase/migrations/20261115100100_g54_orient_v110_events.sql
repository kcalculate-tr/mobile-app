-- G54-S1 md.3 — 1.1.0 oryantasyonu olayları (tanıtım + uygulama içi ipuçları).
-- DURUM: YALNIZ DOSYA (canlıya UYGULANMADI). İdempotent: tekrar çalıştırmak güvenli.
-- Rollback: supabase/rollbacks/20261115100100_g54_orient_v110_events_rollback.sql
-- Önkoşul: analytics_event_names (D-S1, yoksa atlanır). src/lib/metrics/events.ts ile birebir.
-- Kişisel / sağlık verisi YOK: yalnız adım adı (intro_1..4 | scan | home | kesfet | eatkcal).
-- "Görüldü" işareti için şema değişikliği YOK: profiles.onboarding_state.orient_v110_seen_at (mevcut jsonb, G18).
begin;

do $$
begin
  if to_regclass('public.analytics_event_names') is null then
    raise notice 'g54_orient_v110_events: analytics_event_names yok — olay satırları atlandı';
    return;
  end if;
  insert into public.analytics_event_names
    (name, category, source, description_tr, description_en, props_hint, alias_of, is_kpi)
  values
    ('orient_v110_view', 'lifecycle', 'client', '1.1.0 oryantasyon adımı görüldü', '1.1.0 orientation step viewed', 'step: intro_1..4|scan|home|kesfet|eatkcal', null, false),
    ('orient_v110_complete', 'lifecycle', 'client', '1.1.0 oryantasyonu tamamlandı', '1.1.0 orientation completed', null, null, false),
    ('orient_v110_skip', 'lifecycle', 'client', '1.1.0 oryantasyonu geçildi', '1.1.0 orientation skipped', 'step: intro_1..4|scan|home|kesfet|eatkcal', null, false)
  on conflict (name) do nothing;
end $$;

commit;
