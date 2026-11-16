-- 16 Kas — eatkcal kampanya bannerları (Kasım 2026): TR/EN görsel + 3 yeni banner.
-- Kaynak: ana sayfa kampanya kartı (CampaignCard 300×104) = banner_rows + banner_cells (BossVitrin);
-- campaignCellsFrom → hero satırları, sonra promo satırları "order" sırasıyla.
-- Görseller: storage images/campaigns/2026-11/kampanyaN-{tr,en}.webp (1800×624).
-- İdempotent (sabit kimlikler). Rollback: supabase/rollbacks/20261116120100_banner_kampanya_2026_11_rollback.sql
begin;

-- 1) İngilizce görsel alanı (boşsa uygulama TR görseline düşer).
alter table public.banner_cells add column if not exists image_url_en text;
comment on column public.banner_cells.image_url_en is '16 Kas: İngilizce banner görseli; boşsa image_url';

-- 2) Yeni promo satırı, mevcut marka bannerlarının (order 3) önünde.
insert into public.banner_rows (id, type, grid_size, "order", is_active)
values ('5b1e0c2a-7f3d-4e61-9a10-2026110000a1', 'promo', 3, 1, true)
on conflict (id) do update set type = excluded.type, grid_size = excluded.grid_size, "order" = excluded."order", is_active = excluded.is_active;

-- 3) Hücreler: 1 → menü (kcal. mağazası), 2 → paywall (Fresh yıllık seçili), 3 → Davet ekranı.
--    Kampanya 1, HOSGELDIN250 (campaigns 1e841ba8-6eaf-48fa-97aa-3d344f2577a6) kampanyasının görseli; kupon kurallarına dokunulmaz.
--    Kampanya 3 kapalı başlar: Davet ekranı (EkInvite, G56) + `davet` bayrağı yayına girince açılır.
insert into public.banner_cells (id, row_id, position, image_url, image_url_en, title, link, navigate_to, is_active)
values
  ('5b1e0c2a-7f3d-4e61-9a10-2026110000c1', '5b1e0c2a-7f3d-4e61-9a10-2026110000a1', 0,
   'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/campaigns/2026-11/kampanya1-tr.webp',
   'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/campaigns/2026-11/kampanya1-en.webp',
   null, null, 'BrandLanding:kcalculate', true),
  ('5b1e0c2a-7f3d-4e61-9a10-2026110000c2', '5b1e0c2a-7f3d-4e61-9a10-2026110000a1', 1,
   'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/campaigns/2026-11/kampanya2-tr.webp',
   'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/campaigns/2026-11/kampanya2-en.webp',
   null, null, 'SubPaywall:fresh:yearly', true),
  ('5b1e0c2a-7f3d-4e61-9a10-2026110000c3', '5b1e0c2a-7f3d-4e61-9a10-2026110000a1', 2,
   'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/campaigns/2026-11/kampanya3-tr.webp',
   'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/campaigns/2026-11/kampanya3-en.webp',
   null, null, 'Invite', false)
on conflict (id) do update set
  row_id = excluded.row_id, position = excluded.position, image_url = excluded.image_url,
  image_url_en = excluded.image_url_en, navigate_to = excluded.navigate_to, updated_at = now();

commit;
