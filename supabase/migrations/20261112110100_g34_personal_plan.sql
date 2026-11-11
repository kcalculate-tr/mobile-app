-- G34-S1 md.1 (Tur 26o) — Kişisel plan verisi. DURUM: YALNIZ DOSYA (canlıya UYGULANMADI).
-- İdempotent: tekrar çalıştırmak güvenli. Rollback: supabase/rollbacks/20261112110100_g34_personal_plan_rollback.sql
-- Önkoşul: user_nutrition_profiles, body_measurements, feature_flags (canlıda var).
--
-- KARAR (ilişki incelemesi): `user_nutrition_profiles` kullanıcı başına TEK satır (user_id unique)
-- ve bugün hedef/makro/aktivite/ölçüler zaten orada. Kişisel plan aynı varlığın genişlemesi olduğu
-- için YENİ TABLO açılmadı; kolon eklendi (mevcut okuyucular — get_nutrition_summary, Ana sayfa
-- halkası, Takibe başla — hiç değişmeden plan hedefini görür):
--   birth_year, gender_choice ('female'|'male'|'unspecified'; `gender` hesap cinsiyeti olarak kalır),
--   target_weight_kg, pace_kg_week, body_fat_pct, arm_cm, plan_target_date, plan_started_at,
--   plan_version (hesap algoritması sürümü), plan_updated_at,
--   personal_plan jsonb (hedef, egzersiz, beslenme, öğün düzeni, hatırlatmalar, hesap sonucu + ara
--   değerler, öneri değerleri; şema istemcide src/modules/personalPlan/types.ts).
-- Haftalık tartı/ölçü: MEVCUT `body_measurements` (user_id, date unique) kullanılır; yalnız
-- `arm_cm` ve `body_fat_pct` eklenir (Ölçüler adımı / check-in "Ölçü ekle").
-- Akış ilerlemesi (Kaldığın yerden): yeni küçük tablo `personal_plan_progress` (kullanıcı başına
-- tek satır; adım + cevaplar). Yerelde AsyncStorage'da da tutulur; sunucu cihaz değişimi içindir.
-- RLS: yalnız kendi satırı (yeni tabloda select/insert/update/delete auth.uid() = user_id; mevcut iki
-- tabloda politikalar zaten own-row).
-- Bayrak: feature_flags `kisisel_plan` (enabled=false, rollout 0, min_app_version 1.1.0).
begin;

-- 1) user_nutrition_profiles — plan kolonları
alter table public.user_nutrition_profiles
  add column if not exists birth_year int,
  add column if not exists gender_choice text,
  add column if not exists target_weight_kg numeric(5,1),
  add column if not exists pace_kg_week numeric(3,2),
  add column if not exists body_fat_pct numeric(4,1),
  add column if not exists arm_cm int,
  add column if not exists plan_target_date date,
  add column if not exists plan_started_at timestamptz,
  add column if not exists plan_version int,
  add column if not exists plan_updated_at timestamptz,
  add column if not exists personal_plan jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'unp_gender_choice_check') then
    alter table public.user_nutrition_profiles
      add constraint unp_gender_choice_check check (gender_choice is null or gender_choice in ('female', 'male', 'unspecified'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'unp_pace_check') then
    alter table public.user_nutrition_profiles
      add constraint unp_pace_check check (pace_kg_week is null or pace_kg_week in (0, 0.25, 0.5, 0.75));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'unp_body_fat_check') then
    alter table public.user_nutrition_profiles
      add constraint unp_body_fat_check check (body_fat_pct is null or (body_fat_pct >= 3 and body_fat_pct <= 60));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'unp_birth_year_check') then
    alter table public.user_nutrition_profiles
      add constraint unp_birth_year_check check (birth_year is null or (birth_year >= 1900 and birth_year <= 2100));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'unp_personal_plan_object') then
    alter table public.user_nutrition_profiles
      add constraint unp_personal_plan_object check (personal_plan is null or jsonb_typeof(personal_plan) = 'object');
  end if;
end $$;

comment on column public.user_nutrition_profiles.personal_plan is
  'G34 Tur 26o kişisel plan: cevaplar (hedef, egzersiz, beslenme, öğün düzeni, hatırlatmalar) + hesap sonucu/ara değerler + öneri. Şema: src/modules/personalPlan/types.ts';
comment on column public.user_nutrition_profiles.plan_version is 'Kişisel plan hesap algoritması sürümü (PLAN_ALGO_VERSION).';

-- RLS: canlıda zaten var (docs/night/S1-SCHEMA_DUMP.md): nutrition_select_own / insert_own /
-- update_own / delete_own (user_id = auth.uid()) — yeni kolonlar aynı politikalarla korunur.

-- 2) body_measurements — kol ve vücut yağı (haftalık tartı + ölçü aynı satır)
alter table public.body_measurements
  add column if not exists arm_cm int,
  add column if not exists body_fat_pct numeric(4,1);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bm_body_fat_check') then
    alter table public.body_measurements
      add constraint bm_body_fat_check check (body_fat_pct is null or (body_fat_pct >= 3 and body_fat_pct <= 60));
  end if;
  -- (user_id, date) tekilliği canlıda var: body_measurements_user_id_date_key (istemci upsert'i).
end $$;

-- RLS: canlıda body_measurements_own (ALL, auth.uid() = user_id) — yeni kolonlar aynı politikayla.

-- 3) Akış ilerlemesi (Kaldığın yerden)
create table if not exists public.personal_plan_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  step text not null,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  flow_version int not null default 1,
  updated_at timestamptz not null default now()
);

comment on table public.personal_plan_progress is
  'G34 Tur 26o: kişisel plan akışında son cevaplanan adım + cevaplar (Kaldığın yerden). Akış bitince silinir.';

alter table public.personal_plan_progress enable row level security;

drop policy if exists ppp_select_own on public.personal_plan_progress;
create policy ppp_select_own on public.personal_plan_progress for select using (auth.uid() = user_id);
drop policy if exists ppp_insert_own on public.personal_plan_progress;
create policy ppp_insert_own on public.personal_plan_progress for insert with check (auth.uid() = user_id);
drop policy if exists ppp_update_own on public.personal_plan_progress;
create policy ppp_update_own on public.personal_plan_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists ppp_delete_own on public.personal_plan_progress;
create policy ppp_delete_own on public.personal_plan_progress for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.personal_plan_progress to authenticated;

-- 4) Bayrak
insert into public.feature_flags (key, enabled, rollout_percent, min_app_version, description)
values (
  'kisisel_plan', false, 0, '1.1.0',
  'G34-S1 (Tur 26o): Kişisel plan akışı (Profil kartı, Ana sayfa tek seferlik kart, Koç ilk açılış önerisi, satın alma teşekkür butonu), Kişisel planım, haftalık check-in. Kapalı → hiçbir giriş görünmez.'
)
on conflict (key) do nothing;

-- 5) Olay adları (D-S1 sözlüğü varsa) — src/lib/metrics/events.ts ile birebir.
do $$
begin
  if to_regclass('public.analytics_event_names') is null then
    raise notice 'g34_personal_plan: analytics_event_names yok — olay satırları atlandı';
    return;
  end if;
  insert into public.analytics_event_names
    (name, category, source, description_tr, description_en, props_hint, alias_of, is_kpi)
  values
    ('pp_open',     'tracking', 'client', 'Kişisel plan akışı açıldı', 'Personal plan flow opened', 'origin: profile|home|coach|purchase|mine|plan_form|dev, known: bool', null, false),
    ('pp_step',     'tracking', 'client', 'Kişisel plan adımı geçildi', 'Personal plan step passed', 'from: text, to: text', null, false),
    ('pp_resume',   'tracking', 'client', 'Kaldığın yerden', 'Resume where you left off', 'step: text, action: shown|continue|restart', null, false),
    ('pp_exit',     'tracking', 'client', 'Kişisel plan akışından çıkıldı', 'Left the personal plan flow', 'step: text', null, false),
    ('pp_saved',    'tracking', 'client', 'Kişisel plan kaydedildi', 'Personal plan saved', 'goal: lose|maintain|gain|balanced, custom: bool, local_only: bool', null, false),
    ('pp_done',     'tracking', 'client', 'Kişisel plan akışı tamamlandı', 'Personal plan flow completed', 'origin', null, false),
    ('pp_checkin',  'tracking', 'client', 'Haftalık tartı', 'Weekly weigh-in', 'kind: none|on_track|slow|fast|fluctuation, action: saved|apply|keep|skip', null, false),
    ('pp_paywall',  'commerce', 'client', 'Kişisel plan paywall', 'Personal plan paywall', 'action: view|purchase|restore|free, plan: text', null, false)
  on conflict (name) do nothing;
end $$;

commit;
