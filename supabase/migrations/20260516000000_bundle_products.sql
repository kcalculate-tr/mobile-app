-- ═══════════════════════════════════════════════════════════════
-- BUNDLE (ÇOKLU ÜRÜN) FEATURE — DB Foundation
-- ═══════════════════════════════════════════════════════════════
-- Bundle ürünler: is_bundle=true. Makrolar bağlı ürünlerden otomatik
-- toplanır. Bundle değil olanlar mevcut akışta kalır (regression yok).

-- 1. products.is_bundle flag
alter table products
  add column if not exists is_bundle boolean default false not null;

comment on column products.is_bundle is
  'true ise: makrolar bağlı ürünlerden runtime hesaplanır, manuel makro kolonları ignore edilir';

-- 2. linked_product_id: bundle value''sunda gerçek ürün referansı
alter table product_option_template_values
  add column if not exists linked_product_id bigint
    references products(id) on delete set null;

comment on column product_option_template_values.linked_product_id is
  'Bundle senaryosu: bu value gerçek bir ürünü temsil ediyorsa onun id''si. Makrolar (calories/protein/carbs/fats) o üründen okunur. Bundle DEĞİL ürünlerde NULL kalır, mevcut text-based davranış korunur.';

create index if not exists idx_template_values_linked_product
  on product_option_template_values(linked_product_id)
  where linked_product_id is not null;

-- 3. allow_repeats: aynı value birden fazla seçilebilir mi
alter table product_option_template_values
  add column if not exists allow_repeats boolean default false not null;

comment on column product_option_template_values.allow_repeats is
  'Bundle senaryosu: kullanıcı bu value''yu aynı seçimde birden fazla seçebilir mi (örn. 6''lı pakete 3x Tavuk Fileto). Sadece bundle ürünlerde anlamlı, tekil ürünlerde ignore edilir.';

-- 4. PostgREST schema cache reload (Dashboard > Settings > API > Reload ile eşdeğer)
notify pgrst, 'reload schema';
