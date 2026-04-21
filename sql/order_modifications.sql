-- Order modifications (customer-initiated cancellation / date / address change requests)
-- Plus a lightweight notifications table used by panels to ping users when their request is reviewed.
-- Safe re-run: uses IF NOT EXISTS guards and idempotent policy creates.

-- ─────────────────────────────────────────────────────────────────────────────
-- order_modifications
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_modifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  type text NOT NULL CHECK (type IN ('cancel','date_change','address_change')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  old_scheduled_date date,
  new_scheduled_date date,
  old_scheduled_time text,
  new_scheduled_time text,
  old_address_id uuid,
  new_address_id uuid,
  new_address_text text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  reject_reason text,
  customer_note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_modifications_order
  ON public.order_modifications(order_id);

CREATE INDEX IF NOT EXISTS idx_order_modifications_user
  ON public.order_modifications(user_id);

CREATE INDEX IF NOT EXISTS idx_order_modifications_pending
  ON public.order_modifications(status)
  WHERE status = 'pending';

ALTER TABLE public.order_modifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'order_modifications'
      AND policyname = 'Users can create own modifications'
  ) THEN
    CREATE POLICY "Users can create own modifications"
      ON public.order_modifications
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'order_modifications'
      AND policyname = 'Users can view own modifications'
  ) THEN
    CREATE POLICY "Users can view own modifications"
      ON public.order_modifications
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'order_modifications'
      AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access"
      ON public.order_modifications
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- notifications (no existing table found in repo SQL when this file was authored)
-- Drop this block if you already have a notifications table with a conflicting schema.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'notifications'
      AND policyname = 'Users can view own notifications'
  ) THEN
    CREATE POLICY "Users can view own notifications"
      ON public.notifications
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'notifications'
      AND policyname = 'Users can mark own notifications read'
  ) THEN
    CREATE POLICY "Users can mark own notifications read"
      ON public.notifications
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'notifications'
      AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access"
      ON public.notifications
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
