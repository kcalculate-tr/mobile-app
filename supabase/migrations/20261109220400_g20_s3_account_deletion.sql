-- G20-S3 md.7 (B-09) — Hesap silme: support_tickets.user_id FK'si ON DELETE yok
-- (20260309000000_support_tickets.sql:3) → auth.admin.deleteUser() talebi olan
-- kullanıcıda başarısız olabilir. delete-account artık talepleri ÖNCE siliyor
-- (cleanup.ts); bu dosya ikinci güvence: FK → ON DELETE CASCADE.
-- UYGULANMADI (yalnız dosya). Canlıda FK adı farklı olabilir → dinamik bulunur.
-- Rollback: supabase/rollbacks/20261109220400_g20_s3_account_deletion_rollback.sql

begin;

do $$
declare
  c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
     where con.conrelid = 'public.support_tickets'::regclass
       and con.contype = 'f'
       and att.attname = 'user_id'
  loop
    execute format('alter table public.support_tickets drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.support_tickets
  add constraint support_tickets_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

commit;
