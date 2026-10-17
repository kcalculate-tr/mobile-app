-- Trendyol GO durum geri yazma tetikleyicisi.
-- SADECE panelden (gerçek kullanıcı oturumuyla) yapılan değişiklikte çalışır.
-- trendyolgo-poll service_role ile yazdığı için auth.uid() NULL olur ve
-- tetikleyici devreye girmez — yoksa Trendyol'dan OKUDUĞUMUZ statüyü anında
-- Trendyol'a geri yazmaya çalışır, gereksiz çağrı ve 409 üretirdik.
CREATE OR REPLACE FUNCTION public.fn_trendyolgo_push_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_service_key text;
  v_request_id  bigint;
BEGIN
  IF COALESCE(NEW.source,'app') <> 'trendyolgo' OR NEW.external_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('preparing','on_way','delivered','cancelled') THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  IF v_service_key IS NULL THEN
    RAISE WARNING 'fn_trendyolgo_push_status: service_role_key Vault''ta yok';
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url := 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/trendyolgo-push-status',
    body := jsonb_build_object('record', jsonb_build_object('id', NEW.id)),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    )
  ) INTO v_request_id;

  RAISE NOTICE 'trendyolgo-push-status tetiklendi (order_id=%, durum=%, request_id=%)',
    NEW.id, NEW.status, v_request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_trendyolgo_push_status failed: % (%)', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_trendyolgo_push_status
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_trendyolgo_push_status();;
