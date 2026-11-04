-- G12-S6 — 20261105000400_g12_flags.sql geri alma (referans).
-- UYGULANMADI. Bayrak kayıtlarını siler; kullanıcı kilitleri
-- (user_feature_unlocks) ON DELETE CASCADE ile birlikte temizlenir.
-- Yalnız bu iki G12 bayrağını hedefler; diğer bayraklara dokunmaz.

begin;

delete from public.feature_flags where key in ('yeni_onboarding', 'yeni_siparis');

commit;
