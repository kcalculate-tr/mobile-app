-- S1 düzeltme 3a — Ürün müsaitlik bayraklarının tek alanda birleştirilmesi
--
-- Durum tespiti (bkz. docs/night/S1-DB_AUDIT.md §5):
--   products.in_stock ve products.is_available fiilen AYNI kavram; canlıda 65
--   ürünün tamamında özdeş. Admin paneli ikisini birlikte yazıyor (tek "Stok
--   durumu" toggle'ı). Kategori/marka/anasayfa sorguları sunucu tarafında
--   SADECE is_available üzerinden filtreliyor (src/lib/categories.ts).
--   => Canonical alan: products.is_available. in_stock artık bunun aynasıdır.
--
--   branch_product_stock.is_available AYRI kalır: şube bazlı (branch_id,product_id)
--   istisna, farklı kardinalite, tek sunucu-taraflı guard. Birleştirilmez.
--
--   products.allow_immediate / allow_scheduled: ölü kolon (gerçekleri
--   delivery_zones'da). Bu migration kapsamı dışında — ayrı temizlik işi.
--
-- Geriye uyumluluk: in_stock kolonu SİLİNMEZ; trigger ile is_available ile
-- çift yönlü senkron tutulur. Eski okuyucular/yazıcılar (mobil in_stock filtresi,
-- şube paneli genelKapali, Adisyo "Faz 4" toggle TODO'su) çalışmaya devam eder.
--
-- staging MCP oturumda olmadığı için BU MIGRATION TEST EDİLMEDİ.

begin;

-- 1) Canonical alanı normalize et: NULL'ları doldur, NOT NULL + DEFAULT true.
update public.products
   set is_available = coalesce(is_available, in_stock, true)
 where is_available is null;

update public.products
   set in_stock = is_available
 where in_stock is distinct from is_available;

alter table public.products
  alter column is_available set default true,
  alter column is_available set not null;

-- 2) Çift yönlü senkron trigger'ı (in_stock <-> is_available).
create or replace function public.fn_products_sync_availability()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    -- Yeni kayıt: is_available verilmemişse in_stock'tan (yoksa true) türet.
    if new.is_available is null then
      new.is_available := coalesce(new.in_stock, true);
    end if;
    new.in_stock := new.is_available;
  else -- UPDATE
    if new.is_available is distinct from old.is_available then
      -- Canonical değişti: in_stock'u ona hizala (iki alan da değiştiyse canonical kazanır).
      new.in_stock := new.is_available;
    elsif new.in_stock is distinct from old.in_stock then
      -- Yalnızca eski alan değişti (eski yazıcı): canonical'a yansıt.
      new.is_available := new.in_stock;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_sync_availability on public.products;
create trigger trg_products_sync_availability
  before insert or update of is_available, in_stock on public.products
  for each row execute function public.fn_products_sync_availability();

-- Trigger fonksiyonu trigger-amaçlı; REST/RPC üzerinden çağrılmasına gerek yok.
revoke all on function public.fn_products_sync_availability() from public, anon, authenticated;

commit;
