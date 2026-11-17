-- G58-S2 md.4 (17 Kas) — 20261116210100_davet_canli_kampanya_hedef.sql'in yerine (o dosya _superseded, no-op).
-- Yalnız VERİ. Geri alma: supabase/rollbacks/20261117210200_davet_canli_kampanya_hedef_v2_rollback.sql
--
-- 1) Davet ödülü artık TL değil: iki tarafa 1 ücretsiz öğün kuponu (20261117210100 referral_on_delivery).
--    TL ödül ayarı boş; ilk sipariş alt sınırı YOK (İlter: "ilk siparişi teslim edildiğinde").
update public.settings
   set referral_reward_tl = null,
       referral_min_order_tl = null
 where id = 1;

-- 2) `davet` bayrağı KAPALI KALIR (İlter). Bu dosya bayrağa dokunmaz.
-- 3) "Davet et" banner'ı (kampanya3) bayrak açılana kadar PASİF kalır; açılışta ayrıca:
--    update public.banner_cells set is_active = true, audience = 'signed_in' where id = '5b1e0c2a-7f3d-4e61-9a10-2026110000c3';
--    (istemci de bayrak kapalıyken Invite hedefli banner'ı gizler — bannerVisible).

-- 4) "İlk siparişe 250 TL" banner'ı (kampanya1) → kampanya sayfası (koşullar + Kodu tanımla);
--    yalnız hiç siparişi olmayanlara (kod first_order_only). Davetten bağımsız.
update public.banner_cells
   set navigate_to = 'Campaign:1e841ba8-6eaf-48fa-97aa-3d344f2577a6', audience = 'no_orders'
 where id = '5b1e0c2a-7f3d-4e61-9a10-2026110000c1';
