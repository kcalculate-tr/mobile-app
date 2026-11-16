-- G56-S1 — 20261116200100_g56_eatkcal_growth GERİ ALMA.
-- DİKKAT: referrals / referral_codes tablolarını SİLER (davet geçmişi kaybolur). Üretilmiş davet
-- kuponları (campaigns.source = 'referral') kullanıcıya ait olduğu için SİLİNMEZ; istenirse elle pasifleştirin.
-- analytics_events'teki geçmiş olaylara dokunmaz.
begin;

drop trigger if exists trg_referral_on_delivery on public.orders;
drop function if exists public.referral_on_delivery();
drop function if exists public.apply_referral_code(text);
drop function if exists public.my_referral();
drop function if exists public.referral_same_person(uuid, uuid);
drop function if exists public.referral_phone_key(text);
drop function if exists public.gen_referral_code();
drop table if exists public.referrals;
drop table if exists public.referral_codes;
alter table public.settings drop column if exists referral_min_order_tl;
alter table public.settings drop column if exists referral_reward_tl;

drop function if exists public.top_products_week(int);

alter table public.banner_cells drop constraint if exists banner_cells_audience_chk;
alter table public.banner_cells drop column if exists audience;

delete from public.feature_flags where key = 'davet';

do $$
begin
  if to_regclass('public.analytics_event_names') is not null then
    delete from public.analytics_event_names where name in ('eatkcal_sec_view', 'eatkcal_sec_tap', 'referral_share', 'referral_apply');
  end if;
end $$;

commit;
