-- G41-S1 md.4 — Seçenek görseli veri düzeltmesi. DURUM: YALNIZ DOSYA (canlıya UYGULANMADI).
-- Rollback: supabase/rollbacks/20261113100100_g41_option_image_fix_rollback.sql
-- Önkoşul: 20261112120100_g35_option_images (option_items.image_url kolonu). Kolon yoksa hiçbir şey yapmaz.
--
-- Sorun: G35 eşlemesindeki gramaj LIKE'ı ('Izgara Köfte %') ÜRÜN adlı seçenekleri de yakalıyor —
-- "Izgara Köfte Basmati ve Brokoli Sebze" (7 satır) ve G38 sonrası "Izgara Köfte Bowl" (9 satır)
-- bağlı ürünlü (linked_product_id) seçeneklere köfte çıkartması yazılıyor. Paket ürünlerinin
-- (id 33, 43) "Ana Öğün Seçimi" kartları bu yüzden ürün fotoğrafı yerine köfte gösteriyordu.
-- Kural: bağlı ürünü olan seçenek ÜRÜNÜN fotoğrafını gösterir; protein/şarküteri çıkartması yalnız
-- gramaj gruplarında. Uygulama 1.1.0 (G41) bu kuralı zaten kodda uygular (veriden bağımsız); bu
-- dosya veriyi de temizler (panel / web / eski önbellek aynı görseli görmesin).
--
-- Yapılan:
--  1) linked_product_id DOLU ve image_url bir protein-/sarkuteri- çıkartması olan option_items
--     satırlarında image_url → NULL (action 'cleared').
--  2) G38 kısa adları G35 eşlemesinden düşen GRAMAJ satırları (bağlı ürünsüz, image_url boş):
--     'Roastbeef <n>g', 'Mortadella <n>g', 'Soya Soslu Sote <n>g' + 'Mavi Haşhaşlı Bagel',
--     'Basmati & Lolorosso' → G35 ile aynı çıkartma (action 'filled'). G38 G35'ten SONRA uygulanırsa
--     bu satırlar zaten doludur ve dokunulmaz.
-- Eski değerler yedek tabloya yazılır (rollback birebir geri koyar).
-- İdempotent: tekrar çalıştırmak güvenli (yedek satırı varsa üzerine yazmaz).
begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'option_items' and column_name = 'image_url'
  ) then
    raise notice 'G41: option_items.image_url yok (G35 uygulanmamış) — atlandı';
    return;
  end if;

  create table if not exists public._g41_option_image_backup (
    option_item_id uuid primary key,
    image_url text,
    action text not null check (action in ('cleared', 'filled')),
    backed_at timestamptz not null default now()
  );
  -- API'den erişilemesin (politika yok = anon/authenticated okuyamaz).
  alter table public._g41_option_image_backup enable row level security;
  comment on table public._g41_option_image_backup is
    'G41-S1 md.4 rollback yedeği: bağlı ürünlü seçeneklerden silinen protein çıkartması URL''leri. Rollback sonrası silinebilir.';

  insert into public._g41_option_image_backup (option_item_id, image_url, action)
  select oi.id, oi.image_url, 'cleared'
  from public.option_items oi
  where oi.linked_product_id is not null
    and oi.image_url ~ '/images/options/(protein|sarkuteri)-[a-z0-9-]+\.webp'
  on conflict (option_item_id) do nothing;

  update public.option_items oi
  set image_url = null
  where oi.linked_product_id is not null
    and oi.image_url ~ '/images/options/(protein|sarkuteri)-[a-z0-9-]+\.webp';

  -- 2) G38 kısa adlı gramaj / baz satırları
  create temporary table g41_short_map (pattern text not null, code text not null) on commit drop;
  insert into g41_short_map (pattern, code) values
    ('^Roastbeef [0-9]+ ?g$', 'sarkuteri-dana-roastbeef'),
    ('^Mortadella [0-9]+ ?g$', 'sarkuteri-mortadella'),
    ('^Soya Soslu Sote [0-9]+ ?g$', 'protein-tavuk-sote'),
    ('^Mavi Haşhaşlı Bagel$', 'ekmek-bagel'),
    ('^Basmati & Lolorosso$', 'baz-basmati-lolorosso');

  insert into public._g41_option_image_backup (option_item_id, image_url, action)
  select oi.id, null, 'filled'
  from public.option_items oi
  join g41_short_map m on btrim(oi.name) ~ m.pattern
  where oi.image_url is null and oi.linked_product_id is null
  on conflict (option_item_id) do nothing;

  update public.option_items oi
  set image_url = 'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/options/' || m.code || '.webp'
  from g41_short_map m
  where btrim(oi.name) ~ m.pattern
    and oi.image_url is null
    and oi.linked_product_id is null;
end $$;

commit;

-- Uygulama sonrası kontrol (yalnız okuma) — 0 satır beklenir:
--   select oi.id, oi.name, oi.image_url from public.option_items oi
--   where oi.linked_product_id is not null and oi.image_url ~ '/images/options/(protein|sarkuteri)-';
