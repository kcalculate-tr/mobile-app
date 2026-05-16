-- Adisyo retry cron: her dakika 'failed' olan immediate siparişleri 'retrying'e çek
-- Exponential backoff: ilk başarısızlıktan itibaren 1, 2, 4, 8, 16 dakika bekler
-- Maksimum 5 deneme; 5'i aşan kayıtlar manuel müdahale ister
--
-- 'retrying'e geçişi trigger yakalar (fn_notify_adisyo_save_order Koşul 2) ve
-- adisyo-save-order Edge Function'ı tekrar tetikler.

SELECT cron.schedule(
  'adisyo-retry-failed',
  '*/1 * * * *',
  $$
    UPDATE orders
    SET adisyo_sync_status = 'retrying'
    WHERE adisyo_sync_status = 'failed'
      AND COALESCE(adisyo_sync_attempts, 0) < 5
      AND delivery_type = 'immediate'
      AND adisyo_last_attempt_at < now() - (
        INTERVAL '1 minute' * power(2, LEAST(COALESCE(adisyo_sync_attempts, 0), 5))
      );
  $$
);
