-- Bunlarin hepsi TRIGGER fonksiyonu; tetikleyici baglami disinda cagrilmalari
-- anlamsiz ama /rest/v1/rpc/<ad> uzerinden anon'a aciktilar. Tetikleyiciler
-- tablo sahibi baglaminda calistigi icin EXECUTE yetkisinin kaldirilmasi
-- tetikleyicileri etkilemez.
do $$
declare f text;
begin
  foreach f in array array[
    'fn_assign_order_branch()',
    'fn_log_branch_assignment()',
    'fn_notify_new_support_ticket()',
    'fn_notify_review_reply()',
    'fn_notify_support_reply()',
    'fn_orders_branch_stock_guard()',
    'fn_reviews_reply_guard()',
    'fn_trendyolgo_push_status()',
    'grant_macros_on_delivery()',
    'handle_new_user()',
    'notify_order_status_change()',
    'orders_guard_insert()',
    'orders_guard_protected_cols()',
    'profiles_guard_protected_cols()',
    'record_campaign_use()',
    'record_order_delivered_event()',
    'record_order_purchase_event()',
    'sync_profile_from_user_metadata()',
    'create_notification_preferences_for_user()',
    'rls_auto_enable()',
    'boss_activity_summary()',
    'boss_customer_activity(uuid[])',
    'fn_resolve_branch_for_order(text, text, uuid)',
    'campaign_has_targets(uuid)'
  ]
  loop
    begin
      execute format('revoke all on function public.%s from public, anon', f);
    exception when others then
      raise notice 'atlandi: % (%)', f, sqlerrm;
    end;
  end loop;
end $$;

-- boss_customers ve boss_customer_activity yalnizca panelden (admin) kullanilir
revoke all on function public.boss_customers(text, text, integer, integer) from public, anon;
grant execute on function public.boss_customers(text, text, integer, integer) to authenticated;
grant execute on function public.boss_activity_summary() to authenticated;
grant execute on function public.boss_customer_activity(uuid[]) to authenticated;

-- fn_branch_availability ve fn_resolve_branch_for_order mobil checkout'ta kullaniliyor
grant execute on function public.fn_branch_availability(text, text, uuid) to anon, authenticated;
grant execute on function public.fn_resolve_branch_for_order(text, text, uuid) to authenticated;
-- kampanya hedef kontrolu uygulamada kullaniliyor
grant execute on function public.campaign_has_targets(uuid) to anon, authenticated;;
