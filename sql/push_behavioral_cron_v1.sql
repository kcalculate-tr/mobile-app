-- ============================================================================
-- push_behavioral_cron_v1.sql
-- Push Notifications — Aşama 4: Davranışsal Cron Job'ları
--
--   1) macro_reminder      — akşam 20:00 Istanbul (17:00 UTC), günde 1
--   2) coupon_expiring     — sabah 10:00 Istanbul (07:00 UTC), günde 1
--   3) inactive_user       — Pazartesi 14:00 Istanbul (11:00 UTC), haftada 1
--   4) cart_abandoned      — DISABLED (sepet DB'de değil; notlar aşağıda)
--
-- Prereqs:
--   * pg_cron + pg_net ENABLED
--   * Vault'ta 'service_role_key' secret (order_status_push_trigger.sql ve
--     push_campaigns_v1.sql ile aynı secret)
--   * notification_templates seed yüklü (push_notifications_v1.sql)
--
-- Supabase Dashboard > SQL Editor'da çalıştırın. İdempotent.
-- ============================================================================

BEGIN;

-- ─── 1) Yeni template: inactive_user ───────────────────────────────────────
INSERT INTO public.notification_templates
  (key, category, title_template, body_template, deep_link)
VALUES (
  'inactive_user',
  'behavioral',
  'Seni özledik! 🫶',
  'Uzun zamandır yoksun. Menüye göz at, yeni ürünler seni bekliyor.',
  'Home'
)
ON CONFLICT (key) DO NOTHING;


-- ─── 2) trigger_behavioral_push — ortak fire-and-forget helper ─────────────
-- Vault'tan service role key okur, send-notification Edge Function'a
-- by_template_single modunda POST atar. pg_net ile async (cron bloklanmaz).
CREATE OR REPLACE FUNCTION public.trigger_behavioral_push(
  p_user_id      uuid,
  p_template_key text,
  p_vars         jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id  bigint;
  v_service_key text;
BEGIN
  SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
   WHERE name = 'service_role_key'
   LIMIT 1;

  IF v_service_key IS NULL OR v_service_key = '' THEN
    RAISE WARNING 'Vault service_role_key not found, skipping behavioral push (user=%, template=%)',
      p_user_id, p_template_key;
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body    := jsonb_build_object(
      'mode',         'by_template_single',
      'user_id',      p_user_id::text,
      'template_key', p_template_key,
      'vars',         COALESCE(p_vars, '{}'::jsonb)
    )
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- Admin panelden "test butonu" çağırabilmesi için grant
GRANT EXECUTE ON FUNCTION public.trigger_behavioral_push(uuid, text, jsonb)
  TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- CRON 1 — macro_reminder (her akşam 20:00 Istanbul)
-- ═══════════════════════════════════════════════════════════════════════════
-- Macro üyeleri + bugün meal_logs kaydı yapmamış olanları hedefler.
-- meal_logs.date kolonu ISO date ('YYYY-MM-DD'); mobile client Istanbul
-- takvim günü ile yazıyor (src/screens/HomeScreen.tsx:163).
DO $$
BEGIN
  PERFORM cron.unschedule('push-macro-reminder');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'push-macro-reminder',
  '0 17 * * *',  -- UTC 17:00 = Istanbul 20:00
  $job$
  DO $body$
  DECLARE
    v_user   record;
    v_today  date := (now() AT TIME ZONE 'Europe/Istanbul')::date;
  BEGIN
    FOR v_user IN
      SELECT p.id AS user_id
        FROM public.profiles p
       WHERE p.privileged_until IS NOT NULL
         AND p.privileged_until > now()
         AND NOT EXISTS (
           SELECT 1 FROM public.meal_logs ml
            WHERE ml.user_id = p.id
              AND ml.date    = v_today
         )
    LOOP
      PERFORM public.trigger_behavioral_push(v_user.user_id, 'macro_reminder');
    END LOOP;
  END
  $body$;
  $job$
);


-- ═══════════════════════════════════════════════════════════════════════════
-- CRON 2 — coupon_expiring (her sabah 10:00 Istanbul)
-- ═══════════════════════════════════════════════════════════════════════════
-- public.campaigns (vitrin global kuponları): ends_at kolonu + is_active.
-- User-scoped coupon tablosu yok, bu yüzden pragmatik: son 24h içinde
-- bitecek aktif kampanya varsa TÜM macro üyelere tek push.
-- (user_coupons tablosu sonra eklenirse burası güncellenir.)
DO $$
BEGIN
  PERFORM cron.unschedule('push-coupon-expiring');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'push-coupon-expiring',
  '0 7 * * *',  -- UTC 07:00 = Istanbul 10:00
  $job$
  DO $body$
  DECLARE
    v_user                record;
    v_has_expiring_coupon boolean;
  BEGIN
    -- 24 saat içinde bitecek aktif kampanya var mı?
    SELECT EXISTS (
      SELECT 1 FROM public.campaigns
       WHERE is_active = true
         AND ends_at IS NOT NULL
         AND ends_at BETWEEN now() AND now() + interval '24 hours'
    ) INTO v_has_expiring_coupon;

    IF NOT v_has_expiring_coupon THEN
      RETURN;
    END IF;

    FOR v_user IN
      SELECT p.id AS user_id
        FROM public.profiles p
       WHERE p.privileged_until IS NOT NULL
         AND p.privileged_until > now()
         -- Son 24h içinde coupon_expiring almamış (gün-başı idempotency)
         AND NOT EXISTS (
           SELECT 1 FROM public.notification_sends ns
            WHERE ns.user_id      = p.id
              AND ns.template_key = 'coupon_expiring'
              AND ns.created_at   > now() - interval '24 hours'
         )
    LOOP
      PERFORM public.trigger_behavioral_push(v_user.user_id, 'coupon_expiring');
    END LOOP;
  END
  $body$;
  $job$
);


-- ═══════════════════════════════════════════════════════════════════════════
-- CRON 3 — inactive_user (her Pazartesi 14:00 Istanbul)
-- ═══════════════════════════════════════════════════════════════════════════
-- 7 günden fazla login yapmamış + en az 7 günlük hesap + son 14 günde
-- inactive_user almamış kullanıcıya haftalık tek push.
DO $$
BEGIN
  PERFORM cron.unschedule('push-inactive-user');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'push-inactive-user',
  '0 11 * * 1',  -- UTC Pzt 11:00 = Istanbul 14:00
  $job$
  DO $body$
  DECLARE
    v_user record;
  BEGIN
    FOR v_user IN
      SELECT u.id AS user_id
        FROM auth.users u
       WHERE (u.last_sign_in_at IS NULL
              OR u.last_sign_in_at < now() - interval '7 days')
         AND u.created_at < now() - interval '7 days'
         AND NOT EXISTS (
           SELECT 1 FROM public.notification_sends ns
            WHERE ns.user_id      = u.id
              AND ns.template_key = 'inactive_user'
              AND ns.created_at   > now() - interval '14 days'
         )
    LOOP
      PERFORM public.trigger_behavioral_push(v_user.user_id, 'inactive_user');
    END LOOP;
  END
  $body$;
  $job$
);


-- ═══════════════════════════════════════════════════════════════════════════
-- CRON 4 — cart_abandoned (DISABLED)
-- ═══════════════════════════════════════════════════════════════════════════
-- Sepet Zustand + AsyncStorage ile SADECE mobile'da tutuluyor
-- (src/store/cartStore.ts). DB'de cart/cart_items tablosu YOK, dolayısıyla
-- "sepette ürün var ama sipariş vermedi" sorgusu sunucu tarafından yanıtlanamaz.
--
-- Alternatif yaklaşımlar (sonra):
--   a) Mobile'da cartStore'un Supabase'e mirror'layan bir senkron eklenir
--      (user_carts tablosu: user_id, cart_json, updated_at). Cron o tabloya bakar.
--   b) Mobile app "sepet oluşturuldu" event'ini analytics_events tablosuna
--      yazar; cron o event'i kontrol eder.
--   c) Checkout'a girip terk etmeyi yakalamak için 'pending_payment' status'lü
--      order'ları hedefler (bu zaten order_status trigger'ında 'payment_failed'
--      ile kısmen çözülüyor; cart_abandoned'a yakın bir şey için:
--      created_at > 1h ago AND status='pending_payment' → push).
--
-- Şimdilik unschedule + NOTICE. Launch sonrası opsiyon (b) veya (c) seçilince
-- bu dosya güncellenir.
DO $$
BEGIN
  PERFORM cron.unschedule('push-cart-abandoned');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'cart_abandoned cron DISABLED — sepet DB''de değil (Zustand + AsyncStorage). cart_abandoned template (Aşama 1 seed''inde) manuel tetik için hâlâ kullanılabilir.';
END $$;

COMMIT;


-- ============================================================================
-- TEST (İlter — read-only + manuel tetik)
-- ============================================================================
--
-- 1) Job'lar kayıt oldu mu? (3 behavioral + 1 dispatcher = 4 satır beklenir)
--    SELECT jobid, jobname, schedule, active
--      FROM cron.job WHERE jobname LIKE 'push-%' ORDER BY jobname;
--
-- 2) Yeni template eklendi mi?
--    SELECT key, category, title_template FROM notification_templates
--      WHERE key = 'inactive_user';
--
-- 3) Manuel tetik (cron beklemeden):
--    SELECT public.trigger_behavioral_push(
--      'fce7072c-66b3-489a-88d3-2dc94880311d'::uuid,
--      'inactive_user'
--    );
--    → iPhone'da "Seni özledik 🫶" push
--
--    SELECT public.trigger_behavioral_push(
--      'fce7072c-66b3-489a-88d3-2dc94880311d'::uuid,
--      'macro_reminder'
--    );
--    → "Günün nasıl geçti? 📊"
--
--    SELECT public.trigger_behavioral_push(
--      'fce7072c-66b3-489a-88d3-2dc94880311d'::uuid,
--      'coupon_expiring'
--    );
--    → "Kuponun süresi bitiyor ⏰"
--
--    SELECT public.trigger_behavioral_push(
--      'fce7072c-66b3-489a-88d3-2dc94880311d'::uuid,
--      'cart_abandoned'
--    );
--    → "Sepetini unuttun mu? 🛒"  (template var, cron disabled)
--
-- 4) Doğrulama (notification_sends log'u)
--    SELECT template_key, status, created_at, sent_at, error_message
--      FROM notification_sends
--     WHERE template_key IN ('inactive_user','macro_reminder','coupon_expiring','cart_abandoned')
--     ORDER BY created_at DESC LIMIT 10;
--
-- 5) Belirli bir cron job'u manuel çalıştır (cron scheduled zaman beklemeden)
--    SELECT (command) FROM cron.job WHERE jobname = 'push-macro-reminder';
--    -- çıkan komutu SQL Editor'da execute et (DO $body$ ... $body$)
--
-- 6) Cron çalıştırma geçmişi
--    SELECT jobid, start_time, end_time, status, return_message
--      FROM cron.job_run_details
--     WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'push-%')
--     ORDER BY start_time DESC LIMIT 20;
--
--
-- ROLLBACK (gerekirse):
--   SELECT cron.unschedule('push-macro-reminder');
--   SELECT cron.unschedule('push-coupon-expiring');
--   SELECT cron.unschedule('push-inactive-user');
--   DROP FUNCTION IF EXISTS public.trigger_behavioral_push(uuid, text, jsonb);
--   DELETE FROM public.notification_templates WHERE key = 'inactive_user';
