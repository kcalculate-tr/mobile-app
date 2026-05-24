-- Adds holiday banner fields to public.settings so admins can flag a
-- temporary closure period (e.g. Eid break) and surface a message to
-- the mobile app's home screen.
--
-- holiday_banner_active: master switch. When TRUE, mobile reads the
--   message and renders the banner. When FALSE, banner is hidden
--   regardless of message content.
-- holiday_banner_message: free-text shown in the banner. Plain text
--   (no markdown). Nullable so admins can clear and reuse.
--
-- closed_dates / closed_dates_note already exist on this table and
-- drive isShopOpenNow + isDateAvailableForScheduled. They are not
-- modified here.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS holiday_banner_active BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS holiday_banner_message TEXT;
