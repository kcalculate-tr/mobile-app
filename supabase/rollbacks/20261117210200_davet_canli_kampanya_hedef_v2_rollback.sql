-- Geri alma: 20261117210200_davet_canli_kampanya_hedef_v2.sql
-- (referral_* ayarları önceden de boştu — G56 varsayılanı; bayrağa dokunulmadı.)
update public.banner_cells set navigate_to = 'BrandLanding:kcalculate', audience = null where id = '5b1e0c2a-7f3d-4e61-9a10-2026110000c1';
