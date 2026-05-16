-- Adisyo Faz 1: Sync state tracking + API call log
-- Mevcut kolonlar korunuyor: adisyo_order_id, adisyo_synced_at, adisyo_sync_error
-- Yeni eklenenler: adisyo_sync_status, adisyo_sync_attempts, adisyo_last_attempt_at

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS adisyo_sync_status text DEFAULT 'pending'
    CHECK (adisyo_sync_status IN ('pending','retrying','saved','success','failed','skipped')),
  ADD COLUMN IF NOT EXISTS adisyo_sync_attempts int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adisyo_last_attempt_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_adisyo_sync_failed
  ON orders(adisyo_sync_status, adisyo_last_attempt_at)
  WHERE adisyo_sync_status IN ('failed','retrying');

-- API call log: SaveOrder/Prepared/OnDelivery/Deliver/Cancel request+response
CREATE TABLE IF NOT EXISTS adisyo_api_log (
  id bigserial PRIMARY KEY,
  order_id bigint REFERENCES orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  request_body jsonb,
  response_status int,
  response_body jsonb,
  error_message text,
  duration_ms int,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adisyo_log_order ON adisyo_api_log(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_adisyo_log_event ON adisyo_api_log(event_type, created_at DESC);

-- Geçmiş siparişlerin sync_status'unu güncelle:
-- adisyo_order_id varsa 'success', sync_error varsa 'failed', diğerleri 'pending'
UPDATE orders SET adisyo_sync_status =
  CASE
    WHEN adisyo_order_id IS NOT NULL THEN 'success'
    WHEN adisyo_sync_error IS NOT NULL THEN 'failed'
    ELSE 'pending'
  END
WHERE adisyo_sync_status = 'pending';
