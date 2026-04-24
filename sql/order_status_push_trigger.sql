-- ============================================================================
-- order_status_push_trigger.sql
-- Order Status Push Notifications Trigger — Aşama 2
--
-- orders.status değiştiğinde pg_net üzerinden send-notification Edge
-- Function'ını asenkron çağırır. Edge Function kullanıcının push token'larına
-- Expo Push API üzerinden bildirim yollar.
--
-- Prereqs:
--   * pg_net extension ENABLED (Supabase > Database > Extensions)
--   * send-notification Edge Function deploy edilmiş olmalı (verify_jwt=false)
--   * notification_templates seed'i yüklü (push_notifications_v1.sql)
--
-- Service role key yapılandırması için dosyanın altındaki talimatlara bak.
--
-- Supabase Dashboard > SQL Editor'da çalıştırın. İdempotent.
-- ============================================================================

BEGIN;

-- ─── 1) Status → template_key mapping ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.map_order_status_to_template_key(p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_status
    WHEN 'confirmed'      THEN 'order_confirmed'
    WHEN 'preparing'      THEN 'order_preparing'
    WHEN 'on_way'         THEN 'order_shipped'
    WHEN 'delivered'      THEN 'order_delivered'
    WHEN 'payment_failed' THEN 'payment_failed'
    -- cancelled, refunded, ready, ready_soon, pending, pending_payment → NULL = push yok
    ELSE NULL
  END;
$$;


-- ─── 2) Trigger function: status değişimi → pg_net → Edge Function ─────────
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template_key  text;
  v_user_id       uuid;
  v_request_id    bigint;
  v_supabase_url  text;
  v_service_key   text;
  v_order_code    text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_template_key := public.map_order_status_to_template_key(NEW.status);

  IF v_template_key IS NULL THEN
    RETURN NEW;
  END IF;

  v_user_id := NEW.user_id;
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- URL hardcoded (secret değil, public proje ref)
  v_supabase_url := 'https://xtjakvinklthlvsfcncu.supabase.co';

  -- Service role key Vault'tan
  SELECT decrypted_secret
    INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  -- Vault'tan okunamadıysa skip + warning
  IF v_service_key IS NULL OR v_service_key = '' THEN
    RAISE WARNING 'Vault secret service_role_key not found, push notification skipped for order %', NEW.id;
    RETURN NEW;
  END IF;

  v_order_code := COALESCE(NEW.order_code, NEW.id::text);

  -- Async HTTP POST via pg_net (non-blocking; trigger order update'i
  -- Edge Function cevabını beklemeden commit edilir).
  SELECT net.http_post(
    url     := v_supabase_url || '/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
    ),
    body    := jsonb_build_object(
      'mode',         'by_template_single',
      'user_id',      v_user_id::text,
      'template_key', v_template_key,
      'vars', jsonb_build_object(
        'order_code', v_order_code,
        'order_id',   NEW.id::text
      ),
      'data', jsonb_build_object(
        'order_id',   NEW.id::text,
        'order_code', COALESCE(NEW.order_code, ''),
        'deep_link',  'ProfileOrders'
      )
    )
  ) INTO v_request_id;

  RAISE NOTICE 'Push triggered: order_id=%, status=%, template=%, pg_net_id=%',
    NEW.id, NEW.status, v_template_key, v_request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Trigger ASLA ana UPDATE'i fail etmemeli.
  RAISE WARNING 'notify_order_status_change failed: % (%)', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;


-- ─── 3) Trigger bind ─────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_notify_order_status_change ON public.orders;
CREATE TRIGGER trg_notify_order_status_change
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_order_status_change();

COMMIT;


-- =========================================
-- ÖNEMLİ: SERVICE ROLE KEY YAPILANDIRMASI (VAULT)
-- =========================================
-- Bu trigger Supabase Vault'tan service_role_key okur.
-- Trigger çalıştırılmadan ÖNCE Vault'a key eklenmeli:
--
-- SELECT vault.create_secret(
--   '<service_role_key>',
--   'service_role_key',
--   'Service role key for send-notification trigger'
-- );
--
-- Doğrulama:
-- SELECT decrypted_secret FROM vault.decrypted_secrets
-- WHERE name = 'service_role_key';
-- =========================================


-- ============================================================================
-- TEST — Trigger canlı mı?
-- ============================================================================
--
-- 1) Bir test sipariş seç (kendi user_id'ne ait, push_tokens'ta aktif token olan):
--      SELECT id, user_id, status, order_code FROM orders
--      WHERE user_id = '<senin user_id>' ORDER BY created_at DESC LIMIT 5;
--
-- 2) Status değiştir:
--      UPDATE orders SET status = 'preparing' WHERE id = <test_order_id>;
--
-- 3) Logları kontrol et:
--      - Supabase Dashboard > Database > Logs'ta RAISE NOTICE görünür
--      - pg_net request:
--          SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;
--      - notification_sends:
--          SELECT * FROM notification_sends ORDER BY created_at DESC LIMIT 5;
--      - iPhone'da push belirmeli.
--
-- 4) Tekrar aynı status'a set (idempotency):
--      UPDATE orders SET status = 'preparing' WHERE id = <test_order_id>;
--    Trigger WHEN clause skip eder, pg_net call yapılmaz.
--
--
-- ROLLBACK (gerekirse):
--   DROP TRIGGER IF EXISTS trg_notify_order_status_change ON public.orders;
--   DROP FUNCTION IF EXISTS public.notify_order_status_change();
--   DROP FUNCTION IF EXISTS public.map_order_status_to_template_key(text);
