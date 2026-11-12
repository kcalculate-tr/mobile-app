-- G36-S1 md.8 (İlter 12 Kas, G34 SORULAR 2) — Kişisel plan sağlık rızası AYRI kaynak.
-- DURUM: YALNIZ DOSYA (canlıya UYGULANMADI). İdempotent: tekrar çalıştırmak güvenli.
-- Rollback: supabase/rollbacks/20261112130100_g36_personal_plan_consent_rollback.sql
-- Önkoşul: 20261111230100_g27_health_consent, 20261112100100_g33_meal_plan (CHECK listeleri).
--
-- Kişisel plan akışı Giriş adımındaki sağlık verisi açık rızası artık
--   kind = 'health_data', source = 'personal_plan', granted = true, doc_slug/doc_version = NULL
-- yazar (önceden 'takibe'). Geçerli sağlık rızası (Takibe başla ya da önceki plan) varsa istemci
-- Giriş'te "Onaylandı" gösterir ve YENİ satır yazmaz.
--
-- İstemci bu migration uygulanmadan önce de güvenli: satır yan kuyrukta bekler; CHECK reddederse
-- diğer yan kuyruk satırları (takibe, meal_plan) tek tek yazılır, yalnız reddedilen bekler
-- (src/lib/consent/store.ts flushQueue).
--
-- Yalnız user_consents.source CHECK genişler; kind listesi ve my_consent_status() DEĞİŞMEZ
-- ('health_data' son değeri kaynaktan bağımsız okunur).
begin;

do $$
begin
  if to_regclass('public.user_consents') is null then
    raise notice 'g36_personal_plan_consent: user_consents yok — CHECK güncellemesi atlandı';
    return;
  end if;
  alter table public.user_consents drop constraint if exists user_consents_source_check;
  alter table public.user_consents
    add constraint user_consents_source_check
    check (source in ('signup_email', 'signup_social', 'notice', 'reconsent', 'settings', 'att', 'scan', 'coach', 'takibe', 'meal_plan', 'personal_plan'));
  comment on column public.user_consents.source is
    'signup_email · signup_social · notice · reconsent · settings · att · scan · coach · takibe · meal_plan · personal_plan (G36: Kişisel plan sağlık rızası)';
end $$;


commit;
