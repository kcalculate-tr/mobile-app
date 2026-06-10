-- =====================================================================
-- KCAL: orders.status='confirmed' olduğunda adisyo-save-order Edge
-- Function'ını otomatik tetikleyen Postgres trigger
--
-- Supabase Dashboard → SQL Editor → New query → bu dosyayı yapıştır
-- → her bölümü sırayla çalıştır
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Gerekli extension'ları enable et (zaten enable olabilirler)
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault;


-- ---------------------------------------------------------------------
-- 2) Service role key'i Vault'a kaydet
--
-- ÖNEMLİ: Aşağıdaki 'PASTE_SERVICE_ROLE_KEY_HERE' yerine GERÇEK
-- service_role key'ini yapıştır. Şuradan al:
-- https://supabase.com/dashboard/project/xtjakvinklthlvsfcncu/settings/api
-- → Project API keys → service_role (secret) → Reveal → kopyala
--
-- Bu key DATABASE içinde encrypted olarak tutulur, başka yere sızmaz.
-- ---------------------------------------------------------------------

-- Eğer önceden kayıtlıysa silelim, sonra ekleyelim (idempotent)
DELETE FROM vault.secrets WHERE name = 'adisyo_service_role_key';

SELECT vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0amFrdmlua2x0aGx2c2ZjbmN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgwNDI3NywiZXhwIjoyMDg2MzgwMjc3fQ.obCq27Caj2vt0yPjw4VddBH88wQeSN2XPWOXNaCRgdQ',
  'adisyo_service_role_key',
  'KCAL adisyo-save-order Edge Function tetikleme için'
);


-- ---------------------------------------------------------------------
-- 3) Trigger function: orders UPDATE olduğunda koşullu Edge Function çağrısı
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notify_adisyo_save_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_service_key text;
  v_request_id  bigint;
  v_url         text := 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/adisyo-save-order';
BEGIN
  -- Sadece status pending/pending_payment'tan confirmed'a geçtiğinde
  -- VE henüz Adisyo'ya gönderilmediyse tetikle
  IF NEW.status = 'confirmed'
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.adisyo_order_id IS NULL
  THEN
    -- Service role key'i Vault'tan oku
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
    WHERE name = 'adisyo_service_role_key'
    LIMIT 1;

    IF v_service_key IS NULL THEN
      RAISE WARNING 'fn_notify_adisyo_save_order: adisyo_service_role_key Vault''ta yok';
      RETURN NEW;
    END IF;

    -- Async HTTP POST (pg_net) — siparişi BEKLETMEZ, Edge Function arka planda çalışır
    SELECT extensions.net.http_post(
      url := v_url,
      body := jsonb_build_object(
        'type', 'UPDATE',
        'table', 'orders',
        'schema', 'public',
        'record', to_jsonb(NEW),
        'old_record', to_jsonb(OLD)
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      )
    ) INTO v_request_id;

    RAISE NOTICE 'adisyo-save-order tetiklendi (order_id=%, order_code=%, net_request_id=%)',
      NEW.id, NEW.order_code, v_request_id;
  END IF;

  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------
-- 4) Trigger'ı orders tablosuna bağla
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_notify_adisyo_save_order ON public.orders;

CREATE TRIGGER trg_notify_adisyo_save_order
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_adisyo_save_order();


-- ---------------------------------------------------------------------
-- 5) Doğrulama: trigger oluştu mu?
-- ---------------------------------------------------------------------
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trg_notify_adisyo_save_order';


-- ---------------------------------------------------------------------
-- 6) (OPSIYONEL) Vault secret'ı doğrula: doğru kaydedildi mi?
--    Bu sorgu key'in tamamını DEĞİL, sadece var olduğunu gösterir.
-- ---------------------------------------------------------------------
SELECT
  name,
  description,
  created_at,
  length(decrypted_secret) AS key_length
FROM vault.decrypted_secrets
WHERE name = 'adisyo_service_role_key';
-- key_length normalde 200+ karakter olmalı (JWT formatında)


-- ---------------------------------------------------------------------
-- 7) (OPSIYONEL — GEÇİCİ TEST) Var olan bir test sipariş üzerinde
--     trigger'ı manuel zorla tetikle. id=14 daha önce Adisyo'ya gitti
--     (adisyo_order_id=407987026), bu yüzden trigger SKIP edecek.
--     Yeni bir test order atmak en temizi.
-- ---------------------------------------------------------------------

-- pg_net request log'larını gör (en son tetiklenen istekler)
-- SELECT id, status_code, error_msg, created
-- FROM net._http_response
-- ORDER BY id DESC
-- LIMIT 10;


-- ---------------------------------------------------------------------
-- KAPATMA: Trigger'ı geri çevirmek istersen
-- ---------------------------------------------------------------------
-- DROP TRIGGER IF EXISTS trg_notify_adisyo_save_order ON public.orders;
-- DROP FUNCTION IF EXISTS public.fn_notify_adisyo_save_order();
-- DELETE FROM vault.secrets WHERE name = 'adisyo_service_role_key';
