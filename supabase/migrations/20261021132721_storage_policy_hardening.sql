-- ════════════════════════════════════════════════════════════════════════════
-- Storage politikalarinin sikilastirilmasi
--
-- images: dort islem de {public} rolune aciktı; uygulamanin icine gomulu anon
--   anahtarla giris yapmadan 257 gorselin tamami silinebiliyor, uzerine
--   yazilabiliyor ve bucket'a dosya yuklenebiliyordu. Her islem icin IKI
--   politika vardi: Supabase panel sihirbazinin urettigi "Allow All 1ffg0oo_*"
--   seti ve elle yazilmis "images_public_*" seti. Ikisi de sikilastirildi.
--   Okuma herkese acik kalir (bucket zaten public, urun gorselleri gerekiyor).
--
-- avatars: "Users can update own avatar" yalnizca bucket_id kontrol ediyordu,
--   dosyanin sahibine bakmiyordu — giris yapmis herhangi biri baskasinin profil
--   fotografinin uzerine yazabiliyordu. Dosya adi `{user_id}.{ext}` oldugu icin
--   sahiplik ad uzerinden dogrulanir.
-- ════════════════════════════════════════════════════════════════════════════

-- ── images: yazma/degistirme/silme yalnizca admin ──────────────────────────
alter policy "Allow All 1ffg0oo_1" on storage.objects
  with check (bucket_id = 'images' and public.is_admin());
alter policy "images_public_insert" on storage.objects
  with check (bucket_id = 'images' and public.is_admin());

alter policy "Allow All 1ffg0oo_2" on storage.objects
  using      (bucket_id = 'images' and public.is_admin())
  with check (bucket_id = 'images' and public.is_admin());
alter policy "images_public_update" on storage.objects
  using      (bucket_id = 'images' and public.is_admin())
  with check (bucket_id = 'images' and public.is_admin());

alter policy "Allow All 1ffg0oo_3" on storage.objects
  using (bucket_id = 'images' and public.is_admin());
alter policy "images_public_delete" on storage.objects
  using (bucket_id = 'images' and public.is_admin());

-- ── avatars: herkes yalnizca kendi dosyasina ───────────────────────────────
alter policy "Users can upload own avatar" on storage.objects
  with check (bucket_id = 'avatars' and split_part(name, '.', 1) = auth.uid()::text);

alter policy "Users can update own avatar" on storage.objects
  using      (bucket_id = 'avatars' and split_part(name, '.', 1) = auth.uid()::text)
  with check (bucket_id = 'avatars' and split_part(name, '.', 1) = auth.uid()::text);

-- avatars'ta DELETE politikasi hic yoktu: kullanici profil fotografini
-- silemiyordu, yalnizca uzerine yazabiliyordu.
create policy "Users can delete own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '.', 1) = auth.uid()::text);;
