-- G49-S1 md.2–3 — profilsiz Ana sayfa kartı ve "Neler yapabilirsin" hızlı eylem olayları. DURUM: YALNIZ DOSYA (canlıya UYGULANMADI).
-- İdempotent: tekrar çalıştırmak güvenli. Rollback: supabase/rollbacks/20261114220100_g49_home_plan_card_events_rollback.sql
-- Önkoşul: analytics_event_names (D-S1, yoksa atlanır). src/lib/metrics/events.ts ile birebir.
-- Kişisel / sağlık verisi YOK: yalnız dokunulan eylemin türü.
begin;

do $$
begin
  if to_regclass('public.analytics_event_names') is null then
    raise notice 'g49_home_plan_card_events: analytics_event_names yok — olay satırları atlandı';
    return;
  end if;
  insert into public.analytics_event_names
    (name, category, source, description_tr, description_en, props_hint, alias_of, is_kpi)
  values
    ('home_plan_card_view', 'lifecycle', 'client', 'Profilsiz Ana sayfa plan kartı görüldü', 'No-profile home plan card viewed', null, null, false),
    ('home_plan_card_tap', 'lifecycle', 'client', 'Profilsiz Ana sayfa kartı / hızlı eylem dokunuşu', 'No-profile home card / quick action tap', 'action: plan|scan|activity|share|coach', null, false)
  on conflict (name) do nothing;
end $$;

commit;
