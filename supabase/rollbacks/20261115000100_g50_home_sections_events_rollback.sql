-- G50-S1 — 20261115000100_g50_home_sections_events GERİ ALMA.
-- Yalnız sözlük satırlarını siler; analytics_events'teki geçmiş olaylara dokunmaz.
begin;

do $$
begin
  if to_regclass('public.analytics_event_names') is not null then
    delete from public.analytics_event_names where name in ('home_tasks_view', 'home_tasks_tap', 'home_recipes_view', 'home_recipes_tap', 'home_coach_prompts_view', 'home_coach_prompts_tap', 'home_streak_view', 'home_streak_tap');
  end if;
end $$;

commit;
