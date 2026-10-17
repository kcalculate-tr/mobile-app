-- Dakikalık sipariş çekme. PASİF başlar; API secret'ları girilince açılacak
-- (cron.alter_job(jobid, active := true) ya da panelden).
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT cron.schedule(
    'trendyolgo-poll',
    '* * * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/trendyolgo-poll',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(
            (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
            ''
          )
        ),
        body := '{}'::jsonb
      );
    $cron$
  ) INTO v_jobid;

  PERFORM cron.alter_job(v_jobid, active := false);
END $$;;
