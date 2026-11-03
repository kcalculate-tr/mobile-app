-- ROLLBACK — 20261103020200_post_media_storage.sql
-- NOT: staging'de test EDİLMEDİ. Uygulanmaz; yalnız dosya olarak tutulur.
-- Kova yalnız boşsa düşürülebilir; güvenlik için yalnız politikalar kaldırılır,
-- kova bırakılır (içindeki görseller kaybolmasın).
drop policy if exists post_media_creator_delete on storage.objects;
drop policy if exists post_media_creator_update on storage.objects;
drop policy if exists post_media_creator_insert on storage.objects;
drop policy if exists post_media_read on storage.objects;
-- delete from storage.buckets where id = 'post-media';  -- yalnız kova boşsa, elle.
