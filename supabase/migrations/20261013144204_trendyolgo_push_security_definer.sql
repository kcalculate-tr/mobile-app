-- DÜZELTME (13.10.2026): fn_trendyolgo_push_status SECURITY INVOKER'dı.
-- Panelden gelen güncelleme 'authenticated' rolüyle çalışıyor; o rolün
-- vault.decrypted_secrets okuma ve net.http_post çağırma yetkisi yok.
-- Fonksiyon servis anahtarını alamadan hata veriyor, hata da kendi EXCEPTION
-- bloğunda yutuluyordu → mutfak "Kuryeye Ver"e basıyor, Trendyol'a hiçbir şey
-- gitmiyor, hiçbir yerde iz kalmıyordu.
--
-- SECURITY DEFINER ile fonksiyon sahibi (postgres) yetkisiyle çalışır.
-- auth.uid() JWT claim'inden okunduğu için "yalnız panelden gelen değişiklikte
-- çalış" koruması bozulmaz — poller service_role ile yazdığında auth.uid()
-- yine NULL döner.
CREATE OR REPLACE FUNCTION public.fn_trendyolgo_push_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Sessiz kalmasın: hata siparişin kendi satırına yazılır, panelde kırmızı
  -- "Trendyol'a iletilemedi" uyarısı olarak görünür.
  BEGIN
    UPDATE public.orders
       SET external_sync_status = 'failed',
           external_sync_error = format('tetikleyici hatasi: %s (%s)', SQLERRM, SQLSTATE),
           external_last_attempt_at = now()
     WHERE id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RAISE WARNING 'fn_trendyolgo_push_status failed: % (%)', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;;
