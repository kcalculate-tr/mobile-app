-- G31-S1 md.5 — kcalAI Koç 30 gün saklama: süresi dolan coach_messages satırlarını GÜNLÜK siler.
-- version: 20261112000100  name: g31_coach_retention_cron
--
-- DURUM: UYGULANMADI (yalnız dosya). Geri alma: supabase/rollbacks/20261112000100_g31_coach_retention_cron_rollback.sql
-- İdempotent: tekrar çalıştırmak güvenli.
-- Önkoşul: 20261111100100_g24_coach (coach_messages, _coach_int_setting, app_settings.coach_retention_days).
--
-- Neden: coach-chat yalnız kullanıcı YENİ mesaj attığında o kullanıcının eski mesajlarını siler;
-- bir daha yazmayan kullanıcının sohbeti süresiz kalırdı. Bu iş her gün 03:30 İstanbul'da
-- (00:30 UTC) coach_retention_days'ten (vars. 30) eski TÜM satırları siler.
--
-- pg_cron: canlıda varlığı bu oturumda doğrulanamadı (MCP okuma reddedildi); repodaki önceki
-- cron migration'ları (macro-expiry, adisyo-reconcile) pg_cron'un canlıda olduğunu gösteriyor.
-- Yine de zamanlama KOŞULLU: cron şeması yoksa yalnız fonksiyon kurulur ve NOTICE düşer —
-- o durumda İlter Dashboard › Integrations › Cron'dan günlük
-- `select public.fn_coach_retention_purge();` işini kurar.
begin;

create or replace function public.fn_coach_retention_purge()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer := greatest(public._coach_int_setting('coach_retention_days', 30), 1);
  v_n    integer;
begin
  delete from public.coach_messages
   where created_at < now() - make_interval(days => v_days);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

comment on function public.fn_coach_retention_purge() is
  'G31-S1: coach_retention_days (vars. 30, en az 1) günden eski coach_messages satırlarını siler; silinen satır sayısını döner. pg_cron günlük çağırır.';

revoke all on function public.fn_coach_retention_purge() from public, anon, authenticated;
grant execute on function public.fn_coach_retention_purge() to service_role;

-- ── Zamanlama (pg_cron varsa; idempotent: önce kaldır, sonra kur) ──────────
do $$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron yok: coach-retention-daily zamanlaması atlandı (Dashboard''dan kurulmalı)';
    return;
  end if;
  perform cron.unschedule(j.jobname) from cron.job j where j.jobname = 'coach-retention-daily';
  perform cron.schedule('coach-retention-daily', '30 0 * * *',
                        $c$ select public.fn_coach_retention_purge(); $c$);
end $$;

commit;
