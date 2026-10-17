CREATE OR REPLACE FUNCTION public.fn_notify_adisyo_save_order()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_service_key text;
  v_request_id  bigint;
  v_is_default  boolean;
  v_cfg         jsonb;
  v_url text := 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/adisyo-save-order';
BEGIN
  -- İki tetikleme koşulu:
  --   (1) Yeni sipariş onaylandı (eski davranış)
  --   (2) Retry cron sync_status='retrying' yaptı
  IF NOT (
    (NEW.status = 'confirmed'
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.adisyo_order_id IS NULL
     AND NEW.delivery_type = 'immediate')
    OR
    (NEW.adisyo_sync_status = 'retrying'
     AND OLD.adisyo_sync_status IS DISTINCT FROM 'retrying'
     AND NEW.delivery_type = 'immediate')
  ) THEN
    RETURN NEW;
  END IF;

  -- ŞUBE KORUMASI (13.10.2026)
  -- Merkez (is_default) dışındaki bir şubenin siparişi, o şubenin KENDİ Adisyo
  -- hesabı tanımlı değilse merkezin hesabına YAZILMAZ. Bayraklı (Mansuroğlu)
  -- siparişleri merkez adisyonuna düşüyordu.
  IF NEW.branch_id IS NOT NULL THEN
    SELECT b.is_default, b.adisyo_config
      INTO v_is_default, v_cfg
      FROM public.branches b
     WHERE b.id = NEW.branch_id;

    IF COALESCE(v_is_default, true) = false
       AND NOT (
         v_cfg IS NOT NULL
         AND COALESCE(v_cfg->>'apiKey','')      <> ''
         AND COALESCE(v_cfg->>'apiSecret','')   <> ''
         AND COALESCE(v_cfg->>'apiConsumer','') <> ''
       )
    THEN
      RAISE NOTICE 'adisyo-save-order ATLANDI (order_id=%, branch_id=%): sube kendi Adisyo hesabi tanimli degil',
        NEW.id, NEW.branch_id;
      RETURN NEW;
    END IF;
  END IF;

  -- Vault'tan service key
  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets WHERE name = 'adisyo_service_role_key' LIMIT 1;

  IF v_service_key IS NULL THEN
    RAISE WARNING 'fn_notify_adisyo_save_order: adisyo_service_role_key Vault''ta yok';
    RETURN NEW;
  END IF;

  -- Edge Function tetikle
  SELECT net.http_post(
    url := v_url,
    body := jsonb_build_object(
      'type', TG_OP,
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

  RAISE NOTICE 'adisyo-save-order tetiklendi (order_id=%, sync_status=%, request_id=%)',
    NEW.id, NEW.adisyo_sync_status, v_request_id;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_notify_adisyo_save_order failed: % (%)', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;;
