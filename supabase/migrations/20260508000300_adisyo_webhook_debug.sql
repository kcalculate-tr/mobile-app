-- Adisyo Faz 3 — HMAC debug kolonları
-- Adisyo'nun gönderdiği imza formülü dökümandakinden farklı çıkıyor;
-- signature_valid=false durumlarında reverse-engineer için ham değerleri saklıyoruz.
-- Sorun çözüldükten sonra bu kolonlar drop edilebilir.

ALTER TABLE adisyo_webhook_events
  ADD COLUMN IF NOT EXISTS debug_received_sig   text,
  ADD COLUMN IF NOT EXISTS debug_expected_sig   text,
  ADD COLUMN IF NOT EXISTS debug_message_string text;
