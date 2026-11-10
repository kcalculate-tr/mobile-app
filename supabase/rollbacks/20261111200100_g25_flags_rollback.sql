-- Geri alma: 20261111200100_g25_flags.sql — iki bayrak satırını siler.
-- (Satır yoksa istemci yerel varsayılanı `false` kullanır → davranış aynı: gizli.)
begin;
delete from public.feature_flags where key in ('yakinda_satirlari', 'paylasim_baglanti');
commit;
