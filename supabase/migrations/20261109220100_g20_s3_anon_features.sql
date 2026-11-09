-- G20-S3 md.3 — Girişten ÖNCE bayrak okuması (anonim). UYGULANMADI (yalnız dosya).
-- Rollback: supabase/rollbacks/20261109220100_g20_s3_anon_features_rollback.sql
--
-- Sorun (G20-S2 SORULAR 6 / YAYIN_KONTROL R1): get_my_features yalnız authenticated
-- çağrılabiliyor → yeni kurulumda (oturum yok) bütün bayraklar kapalı sayılıyor;
-- `yeni_onboarding` %100 açık olsa bile karşılama/onboarding ESKİ yoldan açılıyor.
--
-- Çözüm: get_anon_features(p_app_version, p_platform, p_device_id) — anon da
-- çağırabilir. Kural get_my_features ile AYNI (enabled + kova < rollout_percent +
-- min_app_version + platforms); tek fark kova girdisi: `key || ':anon:' || device_id`
-- (cihazda üretilen rastgele kimlik; kişisel veri değil, hiçbir tabloya yazılmaz).
-- Kullanıcıya özel kilit (user_feature_unlocks) anonimde YOK.
-- device_id yoksa / geçersizse yalnız %100 açık bayraklar açık döner.
--
-- Not: anonim kova ile giriş sonrası kullanıcı kovası farklıdır; %100'de fark yoktur.
-- Ara yüzdelerde (ör. %10) yeni kurulumun onboarding'i cihaz kovasına, giriş sonrası
-- kabuk kullanıcı kovasına göre çözülür (YAYIN_KONTROL'deki dalga planı buna göre).
--
-- İstemci (src/core/flags/FlagsProvider.tsx) bu fonksiyon yokken hata alır ve önbellek
-- / varsayılanla (bugünkü davranış) devam eder → geriye uyumlu.

begin;

create or replace function public.get_anon_features(
  p_app_version text default null,
  p_platform    text default null,
  p_device_id   text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_object_agg(
      ff.key,
      (
        ff.enabled
        and (
          ff.rollout_percent >= 100
          or (
            p_device_id is not null
            and p_device_id ~ '^[A-Za-z0-9_-]{8,64}$'
            and public._ff_fnv1a_bucket(ff.key || ':anon:' || p_device_id) < ff.rollout_percent
          )
        )
        and (ff.min_app_version is null or public._ff_version_gte(p_app_version, ff.min_app_version))
        and (ff.platforms is null or (p_platform is not null and p_platform = any(ff.platforms)))
      )
    ),
    '{}'::jsonb
  )
  from public.feature_flags ff;
$$;

comment on function public.get_anon_features(text, text, text) is
  'G20-S3: girişten önce (anon) bayrak çözümü. get_my_features ile aynı kural; kova cihaz kimliğiyle, kilit yok.';

revoke all on function public.get_anon_features(text, text, text) from public;
grant execute on function public.get_anon_features(text, text, text) to anon, authenticated;

commit;
