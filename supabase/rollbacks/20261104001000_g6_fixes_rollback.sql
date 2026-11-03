-- ROLLBACK — 20261104001000_g6_fixes.sql
-- NOT: staging'de test EDİLMEDİ. Uygulanmaz; yalnız dosya olarak tutulur.
-- G5 sürümlerine geri döndürmez (yalnız G6'da eklenen nesneleri düşürür); G5
-- RPC'lerinin eski gövdelerini isterseniz ilgili G5 migration'larını yeniden koşun.

begin;

drop function if exists public.mod_resolve_report(bigint, text, text);
drop function if exists public.mod_list_reports(text, int, text);

drop policy if exists moderation_actions_mod_select on public.moderation_actions;
drop table if exists public.moderation_actions;

drop function if exists public.content_report_risk(text);

-- content_reports: risk kolonu + G6 status kısıtı geri alınır (status verisi korunur).
alter table public.content_reports drop constraint if exists content_reports_status_check;
alter table public.content_reports drop column if exists risk;
alter table public.content_reports alter column status set default 'pending';

-- ai_scan_reservations: 'consumed' durumu geri alınır (reserved/released'e döner).
alter table public.ai_scan_reservations drop constraint if exists ai_scan_reservations_status_check;
alter table public.ai_scan_reservations
  add constraint ai_scan_reservations_status_check check (status in ('reserved', 'released'));

drop function if exists public.set_profile_privacy(boolean);
drop function if exists public.check_handle(text);
drop function if exists public.get_user_day_progress(uuid);

-- get_public_profile / get_day_rings / check_delivery_city / report_content:
-- G6 gövdeleri bırakılır (düşürülürse istemci kırılır). Eski davranışı geri almak
-- için 20261104000800_g5_rpcs.sql ve 20261104000300_feed_rpcs.sql yeniden koşulur.

commit;
