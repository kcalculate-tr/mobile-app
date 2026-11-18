-- G61-S1 rollback — 20261118100100_g61_share.sql'i geri alır (YALNIZ DOSYA, canlıya uygulanmadı).
-- Not: paylaşılmış l.eatkcal.com/m|d|x bağlantıları bundan sonra "Bu içerik artık yok" gösterir.
begin;

drop function if exists public.get_share_preview(text, text);
drop function if exists public.revoke_share_snapshot(text);
drop function if exists public.get_share_snapshot(text);
drop function if exists public.create_share_snapshot(text, jsonb);
drop function if exists public.share_new_id();
drop function if exists public.share_payload_clean(text, jsonb);
drop table if exists public.share_snapshots;

do $$
begin
  if to_regclass('public.analytics_event_names') is not null then
    delete from public.analytics_event_names where name in ('share_open', 'share_target');
  end if;
end $$;

commit;
