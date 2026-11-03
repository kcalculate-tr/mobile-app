-- Geri alma: 20261104002100_g8_moderation_cron.sql
-- NOT: Yalnız dosya; elle uygulanır. Cron işini kaldırır ve fonksiyonu düşürür.

begin;

select cron.unschedule('moderate_pending_retry');

drop function if exists public.fn_moderate_pending_retry();

commit;
