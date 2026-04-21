-- Follow-up migration: allow branch/admin staff (admin_allowlist) to SELECT/UPDATE
-- order_modifications and INSERT notifications for customers.
-- Without these policies, branch panel silently sees 0 pending requests.
-- Safe re-run: idempotent via pg_policies existence checks.

-- ─────────────────────────────────────────────────────────────────────────────
-- order_modifications: staff SELECT + UPDATE via admin_allowlist
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'order_modifications'
      AND policyname = 'Staff can view all modifications'
  ) THEN
    CREATE POLICY "Staff can view all modifications"
      ON public.order_modifications
      FOR SELECT
      TO authenticated
      USING (EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE a.user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'order_modifications'
      AND policyname = 'Staff can update modifications'
  ) THEN
    CREATE POLICY "Staff can update modifications"
      ON public.order_modifications
      FOR UPDATE
      TO authenticated
      USING (EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE a.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE a.user_id = auth.uid()));
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- notifications: staff INSERT (so approve/reject can notify customer)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'notifications'
      AND policyname = 'Staff can insert notifications'
  ) THEN
    CREATE POLICY "Staff can insert notifications"
      ON public.notifications
      FOR INSERT
      TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE a.user_id = auth.uid()));
  END IF;
END
$$;
