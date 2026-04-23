-- ============================================================================
-- push_notifications_v1.sql
-- Push Notifications Infrastructure — Aşama 1
--   * push_tokens (kullanıcı cihaz token'ları, çoklu cihaz destekli)
--   * notification_preferences (4 kategori toggle + quiet hours)
--   * notification_templates (admin panelden yönetilecek şablonlar)
--   * notification_sends (gönderim audit log'u)
--   * notification_campaigns (admin batch send'ler)
--
-- Admin yetkisi: diğer admin tablolarındaki gibi `admin_allowlist`
-- defensive pattern (user_id öncelikli, email fallback). Bkz.
-- banner_grid_system.sql.
--
-- Supabase Dashboard > SQL Editor'da çalıştırın. İdempotent.
-- ============================================================================

BEGIN;

-- ─── 0) Ortak yardımcılar ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ─── 1) push_tokens ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL,
  device_type     text CHECK (device_type IN ('ios', 'android', 'web')),
  device_name     text,
  app_version     text,
  is_active       boolean NOT NULL DEFAULT true,
  last_used_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, expo_push_token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_active
  ON public.push_tokens(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_push_tokens_active_last_used
  ON public.push_tokens(is_active, last_used_at);

DROP TRIGGER IF EXISTS push_tokens_touch ON public.push_tokens;
CREATE TRIGGER push_tokens_touch
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ─── 2) notification_preferences ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Transactional: sipariş durumu, ödeme, teslimat (UI'da kapatılamaz, kritik)
  transactional_enabled  boolean NOT NULL DEFAULT true,

  -- Kampanya / pazarlama
  marketing_enabled      boolean NOT NULL DEFAULT true,

  -- Hatırlatıcı: teslimat yaklaşıyor, kupon süresi biten, abonelik yenileme
  reminder_enabled       boolean NOT NULL DEFAULT true,

  -- Davranışsal: sepet unutma, inactive, makro
  behavioral_enabled     boolean NOT NULL DEFAULT true,

  -- Quiet hours (gelecek için şema, şimdi kullanılmayacak)
  quiet_hours_start      time,
  quiet_hours_end        time,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS notification_preferences_touch ON public.notification_preferences;
CREATE TRIGGER notification_preferences_touch
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Yeni user için preferences oto-oluşturma
CREATE OR REPLACE FUNCTION public.create_notification_preferences_for_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created_prefs ON auth.users;
CREATE TRIGGER on_auth_user_created_prefs
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_notification_preferences_for_user();

-- Mevcut kullanıcılar için backfill
INSERT INTO public.notification_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;


-- ─── 3) notification_templates ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key             text UNIQUE NOT NULL,
  category        text NOT NULL CHECK (category IN ('transactional', 'marketing', 'reminder', 'behavioral')),
  title_template  text NOT NULL,
  body_template   text NOT NULL,
  deep_link       text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS notification_templates_touch ON public.notification_templates;
CREATE TRIGGER notification_templates_touch
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ─── 4) notification_sends ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_sends (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  template_key   text,
  category       text CHECK (category IN ('transactional', 'marketing', 'reminder', 'behavioral')),
  title          text NOT NULL,
  body           text NOT NULL,
  deep_link      text,
  data           jsonb,
  status         text NOT NULL CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'skipped')),
  error_message  text,
  sent_at        timestamptz,
  delivered_at   timestamptz,
  opened_at      timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_sends_user_created
  ON public.notification_sends(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_sends_status_pending
  ON public.notification_sends(status) WHERE status IN ('queued', 'failed');
CREATE INDEX IF NOT EXISTS idx_notification_sends_category_created
  ON public.notification_sends(category, created_at DESC);


-- ─── 5) notification_campaigns ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_campaigns (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  title             text NOT NULL,
  body              text NOT NULL,
  deep_link         text,
  image_url         text,
  target_type       text NOT NULL CHECK (target_type IN ('all', 'macro_members', 'active_users', 'inactive_users', 'category_buyers', 'zone_based', 'custom_segment')),
  target_params     jsonb,
  scheduled_at      timestamptz,
  sent_at           timestamptz,
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed')),
  target_count      integer DEFAULT 0,
  sent_count        integer DEFAULT 0,
  delivered_count   integer DEFAULT 0,
  opened_count      integer DEFAULT 0,
  failed_count      integer DEFAULT 0,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_campaigns_status_scheduled
  ON public.notification_campaigns(status, scheduled_at);

DROP TRIGGER IF EXISTS notification_campaigns_touch ON public.notification_campaigns;
CREATE TRIGGER notification_campaigns_touch
  BEFORE UPDATE ON public.notification_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ─── 6) RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.push_tokens              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_sends       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_campaigns   ENABLE ROW LEVEL SECURITY;

-- Admin allowlist defensive pattern (user_id öncelikli, email fallback)
DO $$
DECLARE
  has_allowlist boolean;
  has_user_id   boolean;
  has_email     boolean;
  admin_expr    text;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='admin_allowlist'
  ) INTO has_allowlist;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='admin_allowlist' AND column_name='user_id'
  ) INTO has_user_id;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='admin_allowlist' AND column_name='email'
  ) INTO has_email;

  IF has_allowlist AND has_user_id THEN
    admin_expr := 'EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE a.user_id = auth.uid())';
  ELSIF has_allowlist AND has_email THEN
    admin_expr := 'EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE lower(a.email) = lower(coalesce(auth.jwt() ->> ''email'', '''')))';
  ELSE
    -- admin_allowlist yoksa admin policy'leri eklenmiyor; user policy'leri yine de geçerli
    admin_expr := NULL;
  END IF;

  -- ── push_tokens ──
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='push_tokens' AND policyname='push_tokens_user_all') THEN
    CREATE POLICY push_tokens_user_all ON public.push_tokens
      FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF admin_expr IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='push_tokens' AND policyname='push_tokens_admin_select') THEN
      EXECUTE format('CREATE POLICY push_tokens_admin_select ON public.push_tokens FOR SELECT TO authenticated USING (%s)', admin_expr);
    END IF;
  END IF;

  -- ── notification_preferences ──
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_preferences' AND policyname='notification_preferences_user_all') THEN
    CREATE POLICY notification_preferences_user_all ON public.notification_preferences
      FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF admin_expr IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_preferences' AND policyname='notification_preferences_admin_select') THEN
      EXECUTE format('CREATE POLICY notification_preferences_admin_select ON public.notification_preferences FOR SELECT TO authenticated USING (%s)', admin_expr);
    END IF;
  END IF;

  -- ── notification_templates ──
  -- Authenticated user'lar şablonları okuyabilir (deep_link / metin önizleme için)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_templates' AND policyname='notification_templates_select_authenticated') THEN
    CREATE POLICY notification_templates_select_authenticated ON public.notification_templates
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF admin_expr IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_templates' AND policyname='notification_templates_admin_insert') THEN
      EXECUTE format('CREATE POLICY notification_templates_admin_insert ON public.notification_templates FOR INSERT TO authenticated WITH CHECK (%s)', admin_expr);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_templates' AND policyname='notification_templates_admin_update') THEN
      EXECUTE format('CREATE POLICY notification_templates_admin_update ON public.notification_templates FOR UPDATE TO authenticated USING (%1$s) WITH CHECK (%1$s)', admin_expr);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_templates' AND policyname='notification_templates_admin_delete') THEN
      EXECUTE format('CREATE POLICY notification_templates_admin_delete ON public.notification_templates FOR DELETE TO authenticated USING (%s)', admin_expr);
    END IF;
  END IF;

  -- ── notification_sends ──
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_sends' AND policyname='notification_sends_user_select') THEN
    CREATE POLICY notification_sends_user_select ON public.notification_sends
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;

  -- Kullanıcı sadece KENDİ send kaydındaki opened_at'i güncelleyebilir (analytics ping)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_sends' AND policyname='notification_sends_user_update_opened') THEN
    CREATE POLICY notification_sends_user_update_opened ON public.notification_sends
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF admin_expr IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_sends' AND policyname='notification_sends_admin_select') THEN
      EXECUTE format('CREATE POLICY notification_sends_admin_select ON public.notification_sends FOR SELECT TO authenticated USING (%s)', admin_expr);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_sends' AND policyname='notification_sends_admin_insert') THEN
      EXECUTE format('CREATE POLICY notification_sends_admin_insert ON public.notification_sends FOR INSERT TO authenticated WITH CHECK (%s)', admin_expr);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_sends' AND policyname='notification_sends_admin_update') THEN
      EXECUTE format('CREATE POLICY notification_sends_admin_update ON public.notification_sends FOR UPDATE TO authenticated USING (%1$s) WITH CHECK (%1$s)', admin_expr);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_sends' AND policyname='notification_sends_admin_delete') THEN
      EXECUTE format('CREATE POLICY notification_sends_admin_delete ON public.notification_sends FOR DELETE TO authenticated USING (%s)', admin_expr);
    END IF;
  END IF;

  -- ── notification_campaigns ──
  IF admin_expr IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_campaigns' AND policyname='notification_campaigns_admin_select') THEN
      EXECUTE format('CREATE POLICY notification_campaigns_admin_select ON public.notification_campaigns FOR SELECT TO authenticated USING (%s)', admin_expr);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_campaigns' AND policyname='notification_campaigns_admin_insert') THEN
      EXECUTE format('CREATE POLICY notification_campaigns_admin_insert ON public.notification_campaigns FOR INSERT TO authenticated WITH CHECK (%s)', admin_expr);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_campaigns' AND policyname='notification_campaigns_admin_update') THEN
      EXECUTE format('CREATE POLICY notification_campaigns_admin_update ON public.notification_campaigns FOR UPDATE TO authenticated USING (%1$s) WITH CHECK (%1$s)', admin_expr);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_campaigns' AND policyname='notification_campaigns_admin_delete') THEN
      EXECUTE format('CREATE POLICY notification_campaigns_admin_delete ON public.notification_campaigns FOR DELETE TO authenticated USING (%s)', admin_expr);
    END IF;
  END IF;
END $$;


-- ─── 7) Seed templates (temel transactional + behavioral + reminder) ────────
INSERT INTO public.notification_templates (key, category, title_template, body_template, deep_link) VALUES
  ('order_confirmed',      'transactional', 'Siparişin alındı! 🎉',          'Siparişin hazırlanmaya başlandı. Seni bilgilendireceğiz.',           'ProfileOrders'),
  ('order_preparing',      'transactional', 'Siparişin hazırlanıyor 👨‍🍳',   'Mutfağımız senin için çalışıyor.',                                   'ProfileOrders'),
  ('order_shipped',        'transactional', 'Siparişin yolda 🚚',             'Teslimat personelimiz siparişinle birlikte yolda.',                 'ProfileOrders'),
  ('order_delivered',      'transactional', 'Afiyet olsun! 🍽',               'Siparişin teslim edildi. Nasıldı, merak ediyoruz!',                 'ProfileOrders'),
  ('payment_failed',       'transactional', 'Ödeme tamamlanamadı 😕',         'Siparişin için ödeme yapılamadı. Tekrar deneyebilirsin.',           'ProfileOrders'),
  ('cart_abandoned',       'behavioral',    'Sepetini unuttun mu? 🛒',        'Seçtiğin ürünler seni bekliyor. Şimdi sipariş ver.',                'Home'),
  ('macro_reminder',       'behavioral',    'Günün nasıl geçti? 📊',           'Bugünkü makrolarını kaydetmeyi unutma.',                            'Home'),
  ('delivery_tomorrow',    'reminder',      'Yarın teslimatın var 📅',        'Teslimat detaylarını kontrol et.',                                  'ProfileOrders'),
  ('coupon_expiring',      'reminder',      'Kuponun süresi bitiyor ⏰',       'Kuponunu kullanmayı unutma, fırsatı kaçırma.',                      'ProfileCoupons'),
  ('subscription_renewal', 'reminder',      'Abonelik yenileme yaklaşıyor 🔄', 'Macro üyeliğin {{days}} gün içinde yenilenecek.',                   'Subscriptions')
ON CONFLICT (key) DO NOTHING;

COMMIT;
