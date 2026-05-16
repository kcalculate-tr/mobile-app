-- Adisyo Faz 3: Webhook receiver event tablosu
-- Adisyo'dan gelen status update / cancel / stock olaylarını idempotent şekilde tutar.

CREATE TABLE IF NOT EXISTS adisyo_webhook_events (
  id bigserial PRIMARY KEY,
  event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  adisyo_order_id bigint,
  order_id bigint REFERENCES orders(id) ON DELETE SET NULL,
  raw_payload jsonb NOT NULL,
  signature_valid boolean,
  processed boolean DEFAULT false,
  processed_at timestamptz,
  process_error text,
  received_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_unprocessed
  ON adisyo_webhook_events(processed, received_at)
  WHERE processed = false;

CREATE INDEX IF NOT EXISTS idx_webhook_order
  ON adisyo_webhook_events(adisyo_order_id);

CREATE INDEX IF NOT EXISTS idx_webhook_event_type
  ON adisyo_webhook_events(event_type, received_at DESC);
