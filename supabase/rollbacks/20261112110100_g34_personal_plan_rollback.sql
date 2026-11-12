-- G34-S1 md.1 — 20261112110100_g34_personal_plan GERİ ALMA.
-- DİKKAT: kişisel plan kolonları ve akış ilerlemesi SİLİNİR (plan cevapları kaybolur; gerekirse
-- önce dışa aktar). Hedef/makro (target_*) kolonları ve body_measurements satırları KORUNUR.
-- Mevcut RLS politikalarına dokunulmaz (migration onları değiştirmedi).
-- İstemci geri alma sonrası güvenli: `kisisel_plan` bayrağı yoksa yerel varsayılan KAPALI.
begin;

delete from public.feature_flags where key = 'kisisel_plan';
do $$
begin
  if to_regclass('public.analytics_event_names') is not null then
    delete from public.analytics_event_names where name in ('pp_open', 'pp_step', 'pp_resume', 'pp_exit', 'pp_saved', 'pp_done', 'pp_checkin', 'pp_paywall');
  end if;
end $$;

drop table if exists public.personal_plan_progress;

alter table public.body_measurements drop constraint if exists bm_body_fat_check;
alter table public.body_measurements
  drop column if exists arm_cm,
  drop column if exists body_fat_pct;

alter table public.user_nutrition_profiles drop constraint if exists unp_gender_choice_check;
alter table public.user_nutrition_profiles drop constraint if exists unp_pace_check;
alter table public.user_nutrition_profiles drop constraint if exists unp_body_fat_check;
alter table public.user_nutrition_profiles drop constraint if exists unp_birth_year_check;
alter table public.user_nutrition_profiles drop constraint if exists unp_personal_plan_object;
alter table public.user_nutrition_profiles
  drop column if exists birth_year,
  drop column if exists gender_choice,
  drop column if exists target_weight_kg,
  drop column if exists pace_kg_week,
  drop column if exists body_fat_pct,
  drop column if exists arm_cm,
  drop column if exists plan_target_date,
  drop column if exists plan_started_at,
  drop column if exists plan_version,
  drop column if exists plan_updated_at,
  drop column if exists personal_plan;

commit;
