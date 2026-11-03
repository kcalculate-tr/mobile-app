-- G5-S2 — `user-media` özel storage kovası + sahip bazlı politika
-- version: 20261104000700  name: user_media_bucket
--
-- DURUM: Bu dosya YALNIZCA yazıldı; canlıya/staging'e UYGULANMADI (gece kuralı).
-- STAGING'DE TEST EDİLMEDİ. Geri alma: 20261104000700_user_media_bucket_rollback.sql
--
-- Medya kovaları (G5-CONTRACT.md §Medya): `user-media` ÖZEL — AI tarama fotoğrafları
-- ve Gün kartı görselleri. Sahip okur/yazar; başkasıyla paylaşım yalnız kısa ömürlü
-- İMZALI URL ile (imzalı URL token'la erişir, RLS'i baypas eder → çapraz-kullanıcı
-- SELECT politikası GEREKMEZ). Dosya yolu düzeni: `<user_id>/...`.
-- EXIF temizliği istemcide; tür/boyut sınırı kova tanımında.
-- (Karşılaştırma: `social-media` kovası herkese açık — 20261021133946; `post-media`
-- (herkese açık, kurum/üretici görselleri) S1/Keşfet kapsamında, burada DEĞİL.)

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-media', 'user-media', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Sahiplik: yolun ilk klasörü (storage.foldername(name))[1] = auth.uid().
drop policy if exists "user_media_select_own" on storage.objects;
create policy "user_media_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'user-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "user_media_insert_own" on storage.objects;
create policy "user_media_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'user-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "user_media_update_own" on storage.objects;
create policy "user_media_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'user-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'user-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "user_media_delete_own" on storage.objects;
create policy "user_media_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'user-media' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
