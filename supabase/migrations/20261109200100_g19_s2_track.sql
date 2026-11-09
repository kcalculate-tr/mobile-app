-- G19-S2 — Günlük takip açılışı: sunucu tarafı küçük ekler. UYGULANMADI (yalnız dosya).
-- Geriye uyumlu: yeni bayrak satırı + NOT VALID CHECK + (varsa) olay sözlüğü satırları.
-- Rollback: supabase/rollbacks/20261109200100_g19_s2_track_rollback.sql
--
-- 1) feature_flags 'ogun_hatirlatma' — KAPALI. Öğün saatinde kayıt yoksa yerel
--    hatırlatma (fin_reminder_*). Yalnız yeni kabukta etkili; 1.1.0+.
-- 2) activity_logs üst sınırı: log_activity yalnız `minutes > 0` denetliyor.
--    İstemci 1–600 dk / ≤ 300 km uyguluyor; sunucuda da aynı sınır (NOT VALID →
--    mevcut satırlar taranmaz, yalnız yeni yazımlar denetlenir).
-- 3) analytics_event_names (D-S1, 20261109100300_d_s1_kpi.sql) VARSA 7 takip olayı.
--    D-S1 henüz uygulanmadıysa blok atlanır (to_regclass) — sıra bağımsız.
begin;

insert into public.feature_flags (key, enabled, rollout_percent, min_app_version, description)
values (
  'ogun_hatirlatma', false, 0, '1.1.0',
  'G19-S2 — öğün saatinde (10:30/14:30/21:00 İstanbul) o öğün loglanmadıysa yerel hatırlatma; sessiz saat + notification_preferences.reminder_enabled + "Bugün sessize al" uyar. Yalnız yeni kabuk.'
)
on conflict (key) do nothing;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'activity_logs_minutes_max_chk') then
    alter table public.activity_logs
      add constraint activity_logs_minutes_max_chk check (minutes <= 600) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'activity_logs_distance_max_chk') then
    alter table public.activity_logs
      add constraint activity_logs_distance_max_chk check (distance_km is null or (distance_km >= 0 and distance_km <= 300)) not valid;
  end if;
end $$;

do $$
begin
  if to_regclass('public.analytics_event_names') is null then
    raise notice 'analytics_event_names yok (D-S1 uygulanmamış) — olay satırları atlandı';
    return;
  end if;
  insert into public.analytics_event_names (name, category, source, description_tr, description_en, props_hint, alias_of, is_kpi) values
    ('log_add',       'tracking', 'client', 'Öğün kaydı eklendi (Tara/Elle/Keşfet/teslim edilen sipariş)', 'Meal entry added (scan/manual/discover/delivered order)', 'source: scan|manual|kesfet|order|day_card, slot, kcal, offline', 'log_meal', true),
    ('log_edit',      'tracking', 'client', 'Öğün kaydı düzenlendi (porsiyon / öğün)', 'Meal entry edited (portion / meal)', 'field: portion|meal, slot, factor', null, false),
    ('log_delete',    'tracking', 'client', 'Öğün kaydı silindi (undone=true: silme geri alındı)', 'Meal entry deleted (undone=true: delete reverted)', 'source, slot, undone', null, false),
    ('water_add',     'tracking', 'client', 'Su eklendi / geri alındı', 'Water added / undone', 'ml, total_ml, undo', 'log_water', false),
    ('activity_add',  'tracking', 'client', 'Etkinlik eklendi / geri alındı', 'Activity added / undone', 'type, minutes, undo', 'log_activity', false),
    ('streak_day',    'tracking', 'client', 'Günün ilk kaydı (seri günü), günde bir kez', 'First entry of the day (streak day), once per day', 'streak', null, true),
    ('ring_complete', 'tracking', 'client', 'Gün halkası tamamlandı (kcal ≥ hedef), günde bir kez', 'Day ring completed (kcal ≥ target), once per day', 'kcal, target', null, true)
  on conflict (name) do nothing;
end $$;

commit;
