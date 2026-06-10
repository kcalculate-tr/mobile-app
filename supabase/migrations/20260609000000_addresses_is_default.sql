-- Add is_default flag to public.addresses so a user's chosen default address
-- persists in the DB (single source of truth). Previously "Varsayılan Yap" only
-- updated local state / AsyncStorage, so on app reload the most-recently-created
-- address (created_at DESC → normalized[0]) was shown as default instead of the
-- user's choice.
--
-- One-default-per-user is enforced in app code (set chosen = true, all others =
-- false). Idempotent: safe to run if the column already exists.

ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;
