-- G20-S1 rollback — 20261109210100_g20_s1_user_consents.sql
-- DİKKAT: user_consents satırları (rıza kanıtı) silinir. Geri almadan önce
-- gerekiyorsa dışa aktar: copy (select * from public.user_consents) to stdout csv header;
begin;

drop function if exists public.my_consent_status();
drop table if exists public.user_consents;

alter table public.legal_documents
  drop constraint if exists legal_documents_version_pos_chk;
alter table public.legal_documents
  drop column if exists requires_acceptance,
  drop column if exists version;

commit;
