-- ROLLBACK — 20261103000200_function_grants
-- EXECUTE yetkilerini ve search_path ayarlarını önceki (advisor'ın gördüğü) duruma
-- döndürür. NOT: Orijinalde bu fonksiyonlar PUBLIC üzerinden anon'a açıktı; geri
-- alırken anon'a açıkça EXECUTE veriyoruz (public yerine, en yakın güvenli eşdeğer).

begin;

-- 1) validate_coupon — anon erişimini geri aç
grant execute on function public.validate_coupon(text, numeric, text) to anon, authenticated;

-- 2) en_iyi_yorumlar — eski grant'ları geri ver (bkz. 20260926124943:83)
grant execute on function public.en_iyi_yorumlar(integer) to anon, authenticated;

-- 3) campaign_targets_me — anon erişimini geri aç
grant execute on function public.campaign_targets_me(uuid) to anon, authenticated;

-- 4) search_path sabitlemesini kaldır (mutable duruma dön)
alter function public.handle_new_user() reset search_path;
alter function public.record_order_delivered_event() reset search_path;
alter function public.record_order_purchase_event() reset search_path;

commit;
