-- Add admin SELECT policy on public.addresses so the admin panel (Customer 360
-- drawer) can read addresses for any user, not only the currently signed-in
-- admin's own rows.
--
-- Pattern mirrors push_tokens_admin_select in push_notifications_v1.sql:
-- admin_allowlist with user_id is preferred, email fallback is supported.
-- If admin_allowlist does not exist, the policy is not created (user-self
-- policy remains in effect).

DO $$
DECLARE
  has_allowlist boolean;
  has_user_id   boolean;
  has_email     boolean;
  admin_expr    text;
BEGIN
  -- Make sure RLS is on (no-op if already enabled).
  EXECUTE 'ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY';

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
    admin_expr := NULL;
  END IF;

  IF admin_expr IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='addresses' AND policyname='addresses_admin_select'
    ) THEN
      EXECUTE format(
        'CREATE POLICY addresses_admin_select ON public.addresses FOR SELECT TO authenticated USING (%s)',
        admin_expr
      );
    END IF;
  END IF;
END $$;
