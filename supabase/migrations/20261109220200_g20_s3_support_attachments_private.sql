-- G20-S3 md.4 (B-08) — `support-attachments` kovası ÖZEL.
-- DURUM: CANLIDA (Claude 9 Kas uyguladı: kova özel, okuma = sahibi + admin). Bu dosya
-- REPO EŞİTLEMESİDİR ve idempotenttir. Canlıdaki politika adı farklıysa bu dosyayı
-- uygulamak ikinci (aynı anlamlı, izin veren) bir okuma politikası ekler — zararsız,
-- ama uygulamadan önce `select policyname from pg_policies where tablename='objects'
-- and policyname ilike 'support_attach%';` ile karşılaştır.
-- Rollback: supabase/rollbacks/20261109220200_g20_s3_support_attachments_private_rollback.sql
--
-- İstemci (G20-S3): getPublicUrl YOK; talepte yalnız yol (`support_tickets.attachments`
-- jsonb), gösterimde createSignedUrl (300 sn). Yükleme politikası
-- (support_attach_own_insert: tickets/<auth.uid()>/...) DEĞİŞMEZ.

begin;

update storage.buckets set public = false where id = 'support-attachments';

-- Eski "herkese açık okuma" politikası kalkar.
drop policy if exists "support_attach_read" on storage.objects;

-- Okuma: yalnız sahibi (tickets/<uid>/...) ve admin. İmzalı URL üretimi de bu
-- politikaya tabidir (createSignedUrl select yetkisi ister).
drop policy if exists "support_attach_owner_admin_read" on storage.objects;
create policy "support_attach_owner_admin_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'support-attachments'
    and (
      (
        (storage.foldername(name))[1] = 'tickets'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or public.is_admin()
    )
  );

commit;
