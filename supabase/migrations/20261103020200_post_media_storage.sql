-- G5-S1 — `post-media` storage kovası + politikaları.
-- Sözleşme (G5-CONTRACT.md > Medya kovaları): herkese açık okuma (yalnız
-- yayımlanmış kurum/üretici görselleri), yalnız creators yazar.
-- Tür: jpeg/png/webp/heic · boyut ≤ 5 MB. Dosya düzeni: posts/{author_id}/...
-- NOT: staging'de test EDİLMEDİ — yalnız dosya olarak yazıldı, uygulanmadı.
-- Rollback: 20261103020200_post_media_storage_rollback.sql
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media', 'post-media', true, 5242880,            -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Okuma: herkese açık (public URL ile servis edilir).
drop policy if exists post_media_read on storage.objects;
create policy post_media_read on storage.objects
  for select to public
  using (bucket_id = 'post-media');

-- Yazma: yalnız gönderi yazabilen üretici (creators.can_post) ve yalnız kendi
-- klasörüne: posts/{auth.uid()}/...
drop policy if exists post_media_creator_insert on storage.objects;
create policy post_media_creator_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = 'posts'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.feed_can_post(auth.uid())
  );

drop policy if exists post_media_creator_update on storage.objects;
create policy post_media_creator_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.feed_can_post(auth.uid())
  )
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.feed_can_post(auth.uid())
  );

drop policy if exists post_media_creator_delete on storage.objects;
create policy post_media_creator_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.feed_can_post(auth.uid())
  );
