-- Geri alma — 20261103000500_feature_flags
-- UYGULANMADI. Yalnız referans. Uygulanmış olsaydı bu dosya kurulumu geri alır.
-- Not: tablo/kolon silme gece kuralınca yasak; bu rollback yalnız bu gece
-- OLUŞTURULAN nesneleri (henüz hiçbir yerde kullanılmayan) kaldırır.

begin;

drop function if exists public.get_my_features(text, text);
drop function if exists public._ff_version_gte(text, text);
drop function if exists public._ff_fnv1a_bucket(text);

drop table if exists public.user_feature_unlocks;
drop table if exists public.feature_flags;

commit;
