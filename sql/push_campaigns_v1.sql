-- ============================================================================
-- push_campaigns_v1.sql
-- Push Notifications — Aşama 3A
--   * notification_campaigns.target_type CHECK genişletme
--     (+never_ordered, +has_macro_balance)
--   * RLS: admin full access (Aşama 1'de sadece SELECT vardı)
--   * get_campaign_audience() + get_campaign_audience_count() helper'ları
--   * pg_cron job: zamanlanmış kampanya dispatcher (her dakika)
--
-- Prereqs:
--   * pg_net ENABLED
--   * pg_cron ENABLED (Supabase Dashboard > Extensions)
--   * Vault'ta 'service_role_key' secret (order_status_push_trigger.sql'de de
--     kullanılıyor, zaten olması gerekir)
--   * push_notifications_v1.sql ve order_status_push_trigger.sql uygulanmış
--
-- Supabase Dashboard > SQL Editor'da çalıştırın. İdempotent.
-- ============================================================================

BEGIN;

-- ─── 1) target_type CHECK genişlet ─────────────────────────────────────────
-- Eski CHECK'i (otomatik ad ile oluşmuş olabilir) bul ve drop et.
DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'public.notification_campaigns'::regclass
    AND contype  = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%target_type%';

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notification_campaigns DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

ALTER TABLE public.notification_campaigns
  ADD CONSTRAINT notification_campaigns_target_type_check
  CHECK (target_type IN (
    'all',
    'macro_members',
    'active_users',
    'inactive_users',
    'never_ordered',
    'has_macro_balance',
    -- Aşağıdakiler 3B'ye kalıyor, constraint'ten atmıyoruz (forward-compat)
    'category_buyers',
    'zone_based',
    'custom_segment'
  ));


-- ─── 2) RLS — admin full access ────────────────────────────────────────────
ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_campaigns_admin_all    ON public.notification_campaigns;
DROP POLICY IF EXISTS notification_campaigns_admin_select ON public.notification_campaigns;
DROP POLICY IF EXISTS notification_campaigns_admin_insert ON public.notification_campaigns;
DROP POLICY IF EXISTS notification_campaigns_admin_update ON public.notification_campaigns;
DROP POLICY IF EXISTS notification_campaigns_admin_delete ON public.notification_campaigns;

CREATE POLICY notification_campaigns_admin_all ON public.notification_campaigns
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE a.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE a.user_id = auth.uid())
  );


-- ─── 3) touch_updated_at (idempotent; Aşama 1'de de var) ───────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notification_campaigns_touch ON public.notification_campaigns;
CREATE TRIGGER notification_campaigns_touch
  BEFORE UPDATE ON public.notification_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ─── 4) get_campaign_audience — target_type → user_id listesi ──────────────
-- Temiz, plpgsql CASE. STABLE (her çağrıda aynı sonuç aynı tx içinde).
-- SECURITY DEFINER: owner tablolara (auth.users) erişim için.
CREATE OR REPLACE FUNCTION public.get_campaign_audience(p_target_type text)
RETURNS TABLE(user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF p_target_type = 'all' THEN
    RETURN QUERY
      SELECT u.id FROM auth.users u;

  ELSIF p_target_type = 'macro_members' THEN
    RETURN QUERY
      SELECT p.id FROM public.profiles p
      WHERE p.privileged_until IS NOT NULL
        AND p.privileged_until > now();

  ELSIF p_target_type = 'active_users' THEN
    RETURN QUERY
      SELECT DISTINCT o.user_id FROM public.orders o
      WHERE o.user_id IS NOT NULL
        AND o.created_at > now() - interval '30 days'
        AND o.status NOT IN ('cancelled', 'payment_failed', 'refunded');

  ELSIF p_target_type = 'inactive_users' THEN
    RETURN QUERY
      SELECT u.id FROM auth.users u
      WHERE u.last_sign_in_at < now() - interval '30 days'
         OR u.last_sign_in_at IS NULL;

  ELSIF p_target_type = 'never_ordered' THEN
    RETURN QUERY
      SELECT u.id FROM auth.users u
      WHERE NOT EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.user_id = u.id
          AND o.status NOT IN ('cancelled', 'payment_failed')
      );

  ELSIF p_target_type = 'has_macro_balance' THEN
    RETURN QUERY
      SELECT p.id FROM public.profiles p
      WHERE p.macro_balance > 0;

  ELSE
    -- category_buyers, zone_based, custom_segment — 3B
    RETURN;
  END IF;
END;
$$;


-- ─── 5) get_campaign_audience_count — hızlı sayı ───────────────────────────
CREATE OR REPLACE FUNCTION public.get_campaign_audience_count(p_target_type text)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COUNT(*)::integer FROM public.get_campaign_audience(p_target_type);
$$;


-- ─── 6) RPC erişim izinleri ────────────────────────────────────────────────
-- Admin UI anon/authenticated role üzerinden RPC çağıracak.
-- Fonksiyonlar SECURITY DEFINER olduğundan asıl RLS bypass'ı tamam;
-- sadece EXECUTE privilege'ını authenticated'a ver.
GRANT EXECUTE ON FUNCTION public.get_campaign_audience(text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_audience_count(text) TO authenticated;


-- ─── 7) pg_cron dispatcher — her dakika scheduled kampanyaları çalıştır ────
-- Önce mevcut job'u unschedule (idempotent).
DO $$
BEGIN
  PERFORM cron.unschedule('push-campaign-dispatcher');
EXCEPTION WHEN OTHERS THEN
  NULL; -- job yoksa sorun değil
END $$;

SELECT cron.schedule(
  'push-campaign-dispatcher',
  '* * * * *',  -- her dakika
  $job$
    SELECT net.http_post(
      url := 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/send-notification',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || COALESCE(
          (SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'service_role_key' LIMIT 1),
          ''
        )
      ),
      body := jsonb_build_object('mode', 'dispatch_scheduled')
    )
    WHERE EXISTS (
      SELECT 1 FROM public.notification_campaigns
      WHERE status = 'scheduled' AND scheduled_at <= now()
    );
  $job$
);

COMMIT;


-- ============================================================================
-- TEST (İlter çalıştırır, read-only)
-- ============================================================================
--
-- 1) Hedef sayımları (beklenen: 12 / 1 / ... )
--    SELECT
--      public.get_campaign_audience_count('all')                AS all_,
--      public.get_campaign_audience_count('macro_members')      AS macro_members,
--      public.get_campaign_audience_count('active_users')       AS active_users,
--      public.get_campaign_audience_count('inactive_users')     AS inactive_users,
--      public.get_campaign_audience_count('never_ordered')      AS never_ordered,
--      public.get_campaign_audience_count('has_macro_balance')  AS has_macro_balance;
--
-- 2) Cron job listesi (schedule görünmeli)
--    SELECT jobid, jobname, schedule, active
--      FROM cron.job WHERE jobname = 'push-campaign-dispatcher';
--
-- 3) Cron son çalıştırmalar
--    SELECT * FROM cron.job_run_details
--      WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname='push-campaign-dispatcher')
--      ORDER BY start_time DESC LIMIT 5;
--
-- 4) RLS test — anon kullanıcı campaign oluşturamamalı
--    SET LOCAL role = 'anon';
--    INSERT INTO notification_campaigns (name, title, body, target_type, status)
--      VALUES ('x','x','x','all','draft');  -- policy hatası beklenir
--    RESET role;
--
-- ROLLBACK (gerekirse):
--   SELECT cron.unschedule('push-campaign-dispatcher');
--   DROP FUNCTION IF EXISTS public.get_campaign_audience_count(text);
--   DROP FUNCTION IF EXISTS public.get_campaign_audience(text);
--   DROP POLICY  IF EXISTS notification_campaigns_admin_all ON public.notification_campaigns;
--   ALTER TABLE public.notification_campaigns
--     DROP CONSTRAINT IF EXISTS notification_campaigns_target_type_check;
