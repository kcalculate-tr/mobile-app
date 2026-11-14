-- G42-S1 md.1 / md.11 — Yeni onboarding + kayıt + kişisel plan akışı. DURUM: YALNIZ DOSYA (canlıya UYGULANMADI).
-- İdempotent: tekrar çalıştırmak güvenli. Rollback: supabase/rollbacks/20261113120100_g42_yeni_kayit_rollback.sql
-- Önkoşul: feature_flags, app_settings (20261104000600), analytics_event_names (D-S1, yoksa atlanır).
--
-- Bayrak: `yeni_kayit` (enabled=false, rollout 0, min_app_version 1.1.0). Kapalıyken oturumsuz soğuk
-- açılış bugünkü gibi (yeni_onboarding → Onboarding, değilse WelcomeGate); yeni rotalar KAYITLI DEĞİL.
-- A yolu (kişisel plan) ayrıca `kisisel_plan` bayrağına bağlı (G34 satırı; diyetisyen onayı bekliyor):
-- kapalıyken 5. ekrandaki "Şimdi oluştur" gizlenir, herkes B yoluna gider. Bu dosya `kisisel_plan`a DOKUNMAZ.
--
-- Ayarlar (app_settings; istemci yalnız OTURUMLU okur — girişsiz hesapta yerel varsayılan aynı değer):
--   kayit_muscle_surplus_kcal  = 250   "Kas kazanmak" hedefinde günlük sabit fazla (tahmini; tempo sorulmaz).
--   kayit_plan_email_enabled   = true  Kayıttan sonra plan özeti e-postası (hizmet e-postası). `plan-email`
--                                      edge function DEPLOY edilmeden çağrı 404 döner → bant gösterilmez.
-- Yeni tablo YOK: plan G34 kolonlarına (user_nutrition_profiles.personal_plan) yazılır; pazarlama onayı
-- mevcut notification_preferences.marketing_enabled; Meta onayı mevcut user_consents (G41).
begin;

-- 1) Bayrak
insert into public.feature_flags (key, enabled, rollout_percent, min_app_version, description)
values (
  'yeni_kayit', false, 0, '1.1.0',
  'G42-S1: Yeni onboarding (5 ekran, panorama) + kayıt (A: kişisel plan P1–P14 → plan → kayıt → teklif; B: kayıt → ana sayfa → ilk kayıtta kısa profil). A yolu ayrıca kisisel_plan ister. Kapalı → bugünkü onboarding bayt bayt aynı.'
)
on conflict (key) do nothing;

-- 2) Ayarlar
insert into public.app_settings (key, value, description) values
  ('kayit_muscle_surplus_kcal', '250'::jsonb, 'G42: "Kas kazanmak" hedefinde günlük sabit kalori fazlası (tahmini; tempo sorulmaz).'),
  ('kayit_plan_email_enabled',  'true'::jsonb, 'G42: Kayıttan sonra plan özeti e-postası (hizmet e-postası, kampanya YOK). false → çağrı yapılmaz.')
on conflict (key) do nothing;

-- 3) Olay adları (D-S1 sözlüğü varsa) — src/lib/metrics/events.ts ile birebir. Sağlık değeri prop'u YOK.
do $$
begin
  if to_regclass('public.analytics_event_names') is null then
    raise notice 'g42_yeni_kayit: analytics_event_names yok — olay satırları atlandı';
    return;
  end if;
  insert into public.analytics_event_names
    (name, category, source, description_tr, description_en, props_hint, alias_of, is_kpi)
  values
    ('onb_step_view',     'lifecycle', 'client', 'Yeni onboarding ekranı görüntülendi', 'New onboarding screen viewed', 'step: 1-5, lang: tr|en', null, false),
    ('onb_path_choice',   'lifecycle', 'client', 'Onboarding yol ve başlangıç seçimi', 'Onboarding path and start choice', 'path: a|b, start: track|recipes|community', null, false),
    ('reg_q_answer',      'lifecycle', 'client', 'Kayıt sorusu cevaplandı (değer yok)', 'Registration question answered (no value)', 'q: text (soru kimliği), path: a|b', null, false),
    ('plan_ready',        'lifecycle', 'client', 'Kişisel plan hazır (L1 bitti)', 'Personal plan ready (L1 done)', 'recalc: bool', null, false),
    ('reg_signup_method', 'lifecycle', 'client', 'Kayıt yöntemi seçildi', 'Signup method chosen', 'method: apple|google|email|phone|unknown, path: a|b', null, false),
    ('meta_consent',      'marketing', 'client', 'Kayıtta Meta onay kutusu', 'Meta consent box at signup', 'granted: bool, att: granted|denied|undetermined|unavailable', null, false),
    ('paywall_view_reg',  'commerce',  'client', 'Kayıt sonrası teklif görüntülendi', 'Post-signup offer viewed', 'period: yearly|monthly', null, false),
    ('trial_start_reg',   'commerce',  'client', 'Kayıt teklifinden satın alma/deneme', 'Purchase/trial from signup offer', 'plan: text, result: success|cancelled|pending|error', null, false)
  on conflict (name) do nothing;
end $$;

commit;
