-- Geri alma: 20261117230200_g60_post_stats_backfill.sql
-- Doldurulan satırları boşaltır (tablo ve tetikleyiciler 230100 geri alınınca gider).
-- get_feed_ranked açıksa sayaçlar 0 okunur (akış boş KALMAZ, yalnız etkileşim puanı 0).
begin;
delete from public.post_stats;
commit;
