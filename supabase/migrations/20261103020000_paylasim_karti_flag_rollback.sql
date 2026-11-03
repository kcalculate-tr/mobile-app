-- G5-S4 — 20261103020000_paylasim_karti_flag.sql geri alma (referans).
-- UYGULANMADI. Bayrak kaydını siler; kullanıcı kilitleri (user_feature_unlocks)
-- ON DELETE CASCADE ile birlikte temizlenir.

begin;

delete from public.feature_flags where key = 'paylasim_karti';

commit;
