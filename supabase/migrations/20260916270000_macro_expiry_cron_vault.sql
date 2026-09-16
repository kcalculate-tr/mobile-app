-- GÜVENLİK: macro-expiry-daily cron'u service_role JWT'sini DÜZ METİN olarak
-- cron.job.command'a (pg_catalog'da herkese-service-role-erişimi-olan bir
-- tabloda) yazıyordu. push-campaign-dispatcher deseniyle Vault'tan okunacak
-- şekilde değiştiriliyor — artık komut metninde anahtar YOK, sadece Vault
-- lookup'ı var.
select cron.schedule(
  'macro-expiry-daily',
  '0 3 * * *',
  $$
    SELECT net.http_post(
      url := 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/macro-expiry',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
          ''
        )
      ),
      body := '{}'::jsonb
    )
  $$
);
