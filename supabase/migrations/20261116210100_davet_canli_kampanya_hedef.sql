-- 16 Kas — Davet et kazan canlıya + Hoşgeldin banner'ı kampanya sayfasına.
-- Yalnız VERİ (şema değişikliği yok). Geri alma: supabase/rollbacks/20261116210100_davet_canli_kampanya_hedef_rollback.sql
--
-- 1) Davet ödülü — TUTARLAR İLTER ONAYI İLE (öneri: 100 TL kupon, ilk sipariş ≥ 400 TL).
update public.settings
   set referral_reward_tl = 100,
       referral_min_order_tl = 400
 where id = 1;

-- 2) Davet bayrağı aç (ana sayfa kartı, Davet ekranı, Profil satırı, sepette kod satırı).
update public.feature_flags set enabled = true where key = 'davet';

-- 3) "Davet et, ikiniz de kazanın" banner'ı (kampanya3) — yalnız giriş yapmış kullanıcıya.
update public.banner_cells
   set is_active = true, audience = 'signed_in'
 where id = '5b1e0c2a-7f3d-4e61-9a10-2026110000c3';

-- 4) "İlk siparişe 250 TL" banner'ı (kampanya1) → kampanya sayfası (koşullar + Kodu tanımla);
--    yalnız hiç siparişi olmayanlara (kod first_order_only).
update public.banner_cells
   set navigate_to = 'Campaign:1e841ba8-6eaf-48fa-97aa-3d344f2577a6', audience = 'no_orders'
 where id = '5b1e0c2a-7f3d-4e61-9a10-2026110000c1';
