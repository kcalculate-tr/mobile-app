-- S1 düzeltme 3c — Eksik FK index'leri + çift (duplicate) constraint temizliği
--
-- Kaynak: Supabase performance advisors (bkz. docs/night/S1-DB_AUDIT.md §3.2)
--   - unindexed_foreign_keys (0001): FK'lerde kapsayan index yok → JOIN/DELETE yavaş
--   - duplicate_index (0009): product_option_groups'ta özdeş UNIQUE index
--   - ayrıca product_option_groups'ta çift FK constraint tespit edildi (bonus temizlik)
--
-- Geriye uyumlu (yalnızca index ekleme + gereksiz çift constraint kaldırma).
-- staging MCP oturumda olmadığı için BU MIGRATION TEST EDİLMEDİ.

begin;

-- 1) Eksik FK index'leri (sık sorgulanan yollar önce).
create index if not exists idx_orders_address_id          on public.orders(address_id);
create index if not exists idx_orders_branch_id           on public.orders(branch_id);
create index if not exists idx_meal_logs_user_id          on public.meal_logs(user_id);
create index if not exists idx_macro_transactions_user_id on public.macro_transactions(user_id);
create index if not exists idx_feedback_user_id           on public.feedback(user_id);
create index if not exists idx_support_tickets_user_id    on public.support_tickets(user_id);
create index if not exists idx_refunds_order_id           on public.refunds(order_id);
create index if not exists idx_campaign_uses_order_id     on public.campaign_uses(order_id);
create index if not exists idx_profiles_branch_id         on public.profiles(branch_id);
create index if not exists idx_review_item_feedback_review_id on public.review_item_feedback(review_id);
create index if not exists idx_review_item_feedback_user_id   on public.review_item_feedback(user_id);
create index if not exists idx_marketplace_stores_branch_id   on public.marketplace_stores(branch_id);
create index if not exists idx_branch_product_adisyo_product_id on public.branch_product_adisyo(product_id);
create index if not exists idx_option_items_linked_product_id  on public.option_items(linked_product_id);
create index if not exists idx_categories_parent_id       on public.categories(parent_id);
create index if not exists idx_subscription_plans_user_id on public.subscription_plans(user_id);
create index if not exists idx_notification_campaigns_created_by on public.notification_campaigns(created_by);
create index if not exists idx_branch_users_branch_id     on public.branch_users(branch_id);
create index if not exists idx_product_option_groups_group_id  on public.product_option_groups(group_id);
-- Düşük hacimli log tabloları (yine de advisor'ı temizlemek için):
create index if not exists idx_adisyo_webhook_events_order_id on public.adisyo_webhook_events(order_id);
create index if not exists idx_branch_assignment_log_changed_by    on public.branch_assignment_log(changed_by);
create index if not exists idx_branch_assignment_log_from_branch   on public.branch_assignment_log(from_branch_id);
create index if not exists idx_branch_assignment_log_to_branch     on public.branch_assignment_log(to_branch_id);

-- 2) product_option_groups çift constraint temizliği.
--    İki özdeş UNIQUE(product_id, group_id) var; birini bırak (duplicate_index giderilir).
alter table public.product_option_groups drop constraint if exists product_option_groups_unique_product_group;
--    Çift FK: group_id ve product_id için ikişer özdeş FK; eski (_fk) olanları kaldır,
--    kanonik (_fkey) olanlar kalsın. (FK'ler option_groups_pkey/products_pkey'e bakıyor;
--    bırakılacak unique index'e bağımlı değiller → güvenli.)
alter table public.product_option_groups drop constraint if exists product_option_groups_group_fk;
alter table public.product_option_groups drop constraint if exists product_option_groups_product_fk;

commit;
