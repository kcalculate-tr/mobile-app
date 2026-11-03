-- ROLLBACK — 20261103020300_user_media_bucket
-- Politikaları ve kovayı geri alır. UYGULANMADI (yalnız dosya).
-- NOT: Kovada nesne varsa `delete from storage.buckets` hata verir; önce nesneler
-- boşaltılmalı (canlıda uygulanmadığı için burada sorun değil).
begin;
drop policy if exists "user_media_select_own" on storage.objects;
drop policy if exists "user_media_insert_own" on storage.objects;
drop policy if exists "user_media_update_own" on storage.objects;
drop policy if exists "user_media_delete_own" on storage.objects;
delete from storage.buckets where id = 'user-media';
commit;
