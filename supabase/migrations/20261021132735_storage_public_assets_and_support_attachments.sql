-- ── public-assets: zaten vardi ama hic politikasi yoktu ────────────────────
-- Sosyal medya gorselleri icin kullanilacak: herkese acik okuma, admin yazma.
create policy "public_assets_read" on storage.objects
  for select to public
  using (bucket_id = 'public-assets');

create policy "public_assets_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'public-assets' and public.is_admin());

create policy "public_assets_admin_update" on storage.objects
  for update to authenticated
  using      (bucket_id = 'public-assets' and public.is_admin())
  with check (bucket_id = 'public-assets' and public.is_admin());

create policy "public_assets_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'public-assets' and public.is_admin());

-- ── support-attachments: uygulama bu bucket'a yukluyordu ama bucket YOKTU ──
-- SupportScreen.tsx:169 destek talebi eklerini buraya yukluyor, hata
-- `continue` ile yutuluyordu; musteri fotograf ekledi saniyordu ama dosya
-- sessizce kayboluyordu (34 talebin hicbirinde ek yok).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-attachments', 'support-attachments', true, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

-- Kullanici yalnizca kendi klasorune yukleyebilir: tickets/{user_id}/...
create policy "support_attach_own_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = 'tickets'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Okuma: kod getPublicUrl kullandigi icin bucket public; admin ve sahibi
-- panelden/uygulamadan gorebilir.
create policy "support_attach_read" on storage.objects
  for select to public
  using (bucket_id = 'support-attachments');

create policy "support_attach_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'support-attachments' and public.is_admin());;
