-- ROLLBACK — 20261102000300_fk_indexes_and_dupe_cleanup
-- Eklenen index'leri düşürür, kaldırılan çift constraint'leri geri ekler.

begin;

drop index if exists public.idx_orders_address_id;
drop index if exists public.idx_orders_branch_id;
drop index if exists public.idx_meal_logs_user_id;
drop index if exists public.idx_macro_transactions_user_id;
drop index if exists public.idx_feedback_user_id;
drop index if exists public.idx_support_tickets_user_id;
drop index if exists public.idx_refunds_order_id;
drop index if exists public.idx_campaign_uses_order_id;
drop index if exists public.idx_profiles_branch_id;
drop index if exists public.idx_review_item_feedback_review_id;
drop index if exists public.idx_review_item_feedback_user_id;
drop index if exists public.idx_marketplace_stores_branch_id;
drop index if exists public.idx_branch_product_adisyo_product_id;
drop index if exists public.idx_option_items_linked_product_id;
drop index if exists public.idx_categories_parent_id;
drop index if exists public.idx_subscription_plans_user_id;
drop index if exists public.idx_notification_campaigns_created_by;
drop index if exists public.idx_branch_users_branch_id;
drop index if exists public.idx_product_option_groups_group_id;
drop index if exists public.idx_adisyo_webhook_events_order_id;
drop index if exists public.idx_branch_assignment_log_changed_by;
drop index if exists public.idx_branch_assignment_log_from_branch;
drop index if exists public.idx_branch_assignment_log_to_branch;

-- Çift constraint'leri geri ekle (orijinal durumla birebir).
alter table public.product_option_groups
  add constraint product_option_groups_unique_product_group unique (product_id, group_id);
alter table public.product_option_groups
  add constraint product_option_groups_group_fk foreign key (group_id) references public.option_groups(id) on delete cascade;
alter table public.product_option_groups
  add constraint product_option_groups_product_fk foreign key (product_id) references public.products(id) on delete cascade;

commit;
