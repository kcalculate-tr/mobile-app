-- G50-S1 md.1 — Ana sayfa ek bölümleri olayları (ilk gün görevleri · bugünün tarifleri · Koç hazır soruları · seri).
-- DURUM: YALNIZ DOSYA (canlıya UYGULANMADI). İdempotent: tekrar çalıştırmak güvenli.
-- Rollback: supabase/rollbacks/20261115000100_g50_home_sections_events_rollback.sql
-- Önkoşul: analytics_event_names (D-S1, yoksa atlanır). src/lib/metrics/events.ts ile birebir.
-- Kişisel / sağlık verisi YOK: yalnız bölüm, eylem türü ve sayaç.
begin;

do $$
begin
  if to_regclass('public.analytics_event_names') is null then
    raise notice 'g50_home_sections_events: analytics_event_names yok — olay satırları atlandı';
    return;
  end if;
  insert into public.analytics_event_names
    (name, category, source, description_tr, description_en, props_hint, alias_of, is_kpi)
  values
    ('home_tasks_view', 'lifecycle', 'client', 'Ana sayfa ilk gün görevleri görüldü', 'Home first-day tasks viewed', 'done: number, total: number', null, false),
    ('home_tasks_tap', 'lifecycle', 'client', 'Ana sayfa ilk gün görevi dokunuşu', 'Home first-day task tap', 'task: plan|scan|water, done: boolean', null, false),
    ('home_recipes_view', 'lifecycle', 'client', 'Ana sayfa bugünün tarifleri görüldü', 'Home today''s recipes viewed', 'count: number', null, false),
    ('home_recipes_tap', 'lifecycle', 'client', 'Ana sayfa tarif dokunuşu', 'Home recipe tap', 'action: open|add|all', null, false),
    ('home_coach_prompts_view', 'lifecycle', 'client', 'Ana sayfa Koç hazır soruları görüldü', 'Home coach prompts viewed', null, null, false),
    ('home_coach_prompts_tap', 'lifecycle', 'client', 'Ana sayfa Koç hazır sorusu dokunuşu', 'Home coach prompt tap', 'prompt: dinner|protein|week', null, false),
    ('home_streak_view', 'lifecycle', 'client', 'Ana sayfa seri ve haftalık özet görüldü', 'Home streak and week summary viewed', null, null, false),
    ('home_streak_tap', 'lifecycle', 'client', 'Ana sayfa seri kartı dokunuşu', 'Home streak card tap', null, null, false)
  on conflict (name) do nothing;
end $$;

commit;
