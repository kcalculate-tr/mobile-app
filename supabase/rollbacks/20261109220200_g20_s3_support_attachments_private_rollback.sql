-- Rollback: 20261109220200_g20_s3_support_attachments_private.sql
-- DİKKAT: kovayı yeniden herkese açık yapar (B-08 açığı geri gelir). Yalnız acil durumda.
begin;
drop policy if exists "support_attach_owner_admin_read" on storage.objects;
create policy "support_attach_read" on storage.objects
  for select to public
  using (bucket_id = 'support-attachments');
update storage.buckets set public = true where id = 'support-attachments';
commit;
