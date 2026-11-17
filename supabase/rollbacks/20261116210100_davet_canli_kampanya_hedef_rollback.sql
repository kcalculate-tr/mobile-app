-- _superseded (G58-S2): özgün migration no-op'a çevrildi; bu geri alma yalnız eski dosya UYGULANMIŞSA anlamlı.
update public.settings set referral_reward_tl = null, referral_min_order_tl = null where id = 1;
update public.feature_flags set enabled = false where key = 'davet';
update public.banner_cells set is_active = false, audience = null where id = '5b1e0c2a-7f3d-4e61-9a10-2026110000c3';
update public.banner_cells set navigate_to = 'BrandLanding:kcalculate', audience = null where id = '5b1e0c2a-7f3d-4e61-9a10-2026110000c1';
