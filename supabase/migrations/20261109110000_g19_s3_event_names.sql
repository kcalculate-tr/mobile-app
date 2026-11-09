-- G19-S3 — İstemci olay sözlüğünü (src/lib/metrics/events.ts) sunucu sözlüğüne yaz.
-- version: 20261109110000  name: g19_s3_event_names
--
-- DURUM: Bu dosya YALNIZCA yazıldı; canlıya UYGULANMADI (gece kuralı).
-- Önkoşul: D-S1 20261109100300_d_s1_kpi.sql (public.analytics_event_names).
--   Tablo yoksa hiçbir şey yapmaz (NOTICE) — sıra yanlışsa D-S1'den sonra yeniden çalıştırın.
-- İdempotent: ON CONFLICT DO NOTHING — D-S1'in kendi 38 adının açıklamaları korunur;
--   yalnız G19-S3'ün eklediği 14 ad (scan_open, scan_capture, scan_fail, scan_limit,
--   scan_offline, scan_log, log_add, log_edit, log_delete, water_add, activity_add,
--   streak_day, ring_complete, login) yazılır.
-- Kaynak: aşağıdaki VALUES listesi events.ts'den üretildi; test
--   src/lib/metrics/__tests__/metricsDictionary.test.ts iki listeyi eşler.
-- Geri alma: supabase/rollbacks/20261109110000_g19_s3_event_names_rollback.sql

do $$
begin
  if to_regclass('public.analytics_event_names') is null then
    raise notice 'g19_s3_event_names: public.analytics_event_names yok (D-S1 uygulanmamış) — atlandı';
    return;
  end if;

  insert into public.analytics_event_names
    (name, category, source, description_tr, description_en, props_hint, alias_of, is_kpi)
  values
    ('app_open', 'lifecycle', 'client', 'Uygulama açıldı (soğuk/sıcak başlangıç)', 'App opened (cold/warm start)', 'cold, first', null, true),
    ('first_touch', 'lifecycle', 'client', 'İlk açılış kaynağı (derin bağlantı / UTM / QR / saha kodu)', 'First-open attribution (deep link / UTM / QR / field code)', 'source, medium, campaign, content, term, code, link', null, true),
    ('signup', 'lifecycle', 'client', 'Hesap oluşturuldu', 'Account created', 'method', null, true),
    ('login', 'lifecycle', 'client', 'Giriş yapıldı (anonim kimlik kullanıcıya bağlanır)', 'Logged in (anonymous id linked to user)', 'method', null, false),
    ('onb_step', 'lifecycle', 'client', 'Karşılama/kurulum adımı görüldü', 'Onboarding step viewed', 'flow, step, index', null, false),
    ('welcome_view', 'lifecycle', 'client', 'Karşılama ekranı görüldü', 'Welcome screen viewed', null, null, false),
    ('welcome_login_click', 'lifecycle', 'client', 'Karşılamada giriş tıklandı', 'Welcome login tapped', null, null, false),
    ('welcome_skip_click', 'lifecycle', 'client', 'Karşılama atlandı', 'Welcome skipped', 'source', null, false),
    ('scan_open', 'tracking', 'client', 'Tara ekranı açıldı', 'Scan screen opened', null, null, false),
    ('scan_capture', 'tracking', 'client', 'Fotoğraf çekildi/seçildi, analiz başladı', 'Photo captured/picked, analysis started', 'via, has_hint', 'scan_start', false),
    ('scan_start', 'tracking', 'client', 'AI yemek taraması başlatıldı', 'AI food scan started', 'via', null, false),
    ('scan_success', 'tracking', 'client', 'AI taraması sonuç verdi', 'AI scan succeeded', 'n_items, kcal, via', null, true),
    ('scan_fail', 'tracking', 'client', 'AI taraması başarısız', 'AI scan failed', 'code, stage, via', 'scan_failed', false),
    ('scan_failed', 'tracking', 'client', 'AI taraması başarısız (eski ad)', 'AI scan failed (old name)', 'reason', null, false),
    ('scan_limit', 'tracking', 'client', 'Günlük ücretsiz tarama hakkı bitti', 'Daily free scan limit reached', 'via', null, false),
    ('scan_offline', 'tracking', 'client', 'Tarama çevrimdışı kuyruğa alındı', 'Scan queued offline', 'pending', null, false),
    ('scan_log', 'tracking', 'client', 'Tarama sonucu güne kaydedildi', 'Scan result logged to the day', 'n_items, kcal, edited', null, false),
    ('log_add', 'tracking', 'client', 'Öğün kaydedildi', 'Meal logged', 'source, kcal', 'log_meal', true),
    ('log_meal', 'tracking', 'client', 'Öğün kaydedildi (eski ad)', 'Meal logged (old name)', 'source', null, false),
    ('log_edit', 'tracking', 'client', 'Öğün kaydı düzenlendi', 'Meal log edited', 'field', null, false),
    ('log_delete', 'tracking', 'client', 'Öğün kaydı silindi', 'Meal log deleted', 'source, count', null, false),
    ('water_add', 'tracking', 'client', 'Su eklendi (negatif = geri al)', 'Water added (negative = undo)', 'ml', 'log_water', false),
    ('log_water', 'tracking', 'client', 'Su kaydedildi (eski ad)', 'Water logged (old name)', 'ml', null, false),
    ('activity_add', 'tracking', 'client', 'Etkinlik/adım kaydedildi', 'Activity logged', 'type, minutes', 'log_activity', false),
    ('log_activity', 'tracking', 'client', 'Etkinlik kaydedildi (eski ad)', 'Activity logged (old name)', 'type, minutes', null, false),
    ('streak_day', 'tracking', 'client', 'Seri bir gün uzadı', 'Streak extended by a day', 'days', null, false),
    ('ring_complete', 'tracking', 'client', 'Gün halkası tamamlandı', 'Day ring completed', 'ring', null, false),
    ('share', 'social', 'client', 'Paylaşım yapıldı (gönderi / gün kartı / ürün)', 'Content shared (post / day card / product)', 'target, surface', null, true),
    ('follow', 'social', 'client', 'Kullanıcı takip edildi / bırakıldı', 'User followed / unfollowed', 'on, state, surface', null, false),
    ('home_view', 'commerce', 'client', 'Ana sayfa görüldü', 'Home viewed', null, null, false),
    ('banner_view', 'commerce', 'client', 'Afiş görüldü', 'Banner viewed', 'banner_id, source', null, false),
    ('banner_click', 'commerce', 'client', 'Afiş tıklandı', 'Banner tapped', 'banner_id, deeplink, source', null, false),
    ('announcement_strip_click', 'commerce', 'client', 'Duyuru şeridi tıklandı', 'Announcement strip tapped', 'strip_id, deeplink', null, false),
    ('product_view', 'commerce', 'client', 'Ürün görüldü', 'Product viewed', 'product_id, product_name, price, category, brand, ui', null, true),
    ('add_to_cart', 'commerce', 'client', 'Sepete eklendi', 'Added to cart', 'product_id, price, quantity, brand, category', null, true),
    ('remove_from_cart', 'commerce', 'client', 'Sepetten çıkarıldı', 'Removed from cart', 'product_id, price, quantity, reason', null, false),
    ('cart_view', 'commerce', 'client', 'Sepet görüldü', 'Cart viewed', 'item_count, total, ui', null, false),
    ('begin_checkout', 'commerce', 'client', 'Ödemeye geçildi', 'Checkout started', 'price, num_items, coupon_id, ui', null, true),
    ('checkout_start', 'commerce', 'client', 'Ödemeye geçildi (yeni ad)', 'Checkout started (new name)', null, 'begin_checkout', false),
    ('payment_attempt', 'commerce', 'client', 'Ödeme denendi', 'Payment attempted', 'order_id, price, payment_method', null, false),
    ('payment_pending', 'commerce', 'client', 'Ödeme beklemede (3D vb.)', 'Payment pending (3DS etc.)', 'order_id, price, payment_method', null, false),
    ('payment_success', 'commerce', 'client', 'Ödeme başarılı (istemci)', 'Payment succeeded (client)', 'order_id, price, payment_method', null, false),
    ('pay_success', 'commerce', 'client', 'Ödeme başarılı (yeni ad)', 'Payment succeeded (new name)', null, 'payment_success', false),
    ('payment_failed', 'commerce', 'client', 'Ödeme başarısız', 'Payment failed', 'order_id, price, payment_method, reason', null, false),
    ('reorder_from_home', 'commerce', 'client', 'Ana sayfadan tekrar sipariş', 'Reorder from home', 'order_id, added', null, false),
    ('reorder_from_order_detail', 'commerce', 'client', 'Sipariş detayından tekrar sipariş', 'Reorder from order detail', 'order_id, added, ui', null, false),
    ('reorder_from_empty_cart', 'commerce', 'client', 'Boş sepetten tekrar sipariş', 'Reorder from empty cart', 'order_id, added', null, false),
    ('order_review_submitted', 'commerce', 'client', 'Sipariş değerlendirildi', 'Order review submitted', 'order_id, rating, item_votes', null, false),
    ('coupon_apply', 'marketing', 'client', 'Kupon kodu uygulandı', 'Coupon code applied', 'code, ok, reason, discount', null, true),
    ('saha_code_apply', 'marketing', 'client', 'Saha (satış temsilcisi) kodu uygulandı', 'Field-sales code applied', 'code, ok, reason, discount, from_link', null, true),
    ('purchase', 'commerce', 'server', 'Satın alma (sunucu: onaylı + ödenmiş sipariş)', 'Purchase (server: confirmed + paid order)', 'order_id, price, branch_id', null, true),
    ('order_delivered', 'commerce', 'server', 'Sipariş teslim edildi (sunucu)', 'Order delivered (server)', 'order_id, branch_id', null, true)
  on conflict (name) do nothing;
end $$;
