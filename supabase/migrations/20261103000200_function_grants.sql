-- ════════════════════════════════════════════════════════════════════════════
-- G2-S1 Güvenlik — fonksiyon EXECUTE yetkilerinin daraltılması + search_path
-- version: 20261103000200  name: function_grants
-- Hazırlayan: gece-2 güvenlik oturumu (night2/security). STAGING'DE TEST EDİLMEDİ.
-- ════════════════════════════════════════════════════════════════════════════
-- Supabase security advisor (2026-11-02) anon rolünün çalıştırabildiği 9 SECURITY
-- DEFINER fonksiyonu işaretledi. Her biri için "anon GERÇEKTEN çağırıyor mu?"
-- sorusu kodla cevaplandı (G2-S1-SECURITY.md bölüm 3).
--
-- ANON'DA KALACAKLAR (giriş öncesi akışlarda GERÇEKTEN kullanılıyor — DOKUNMA):
--   fn_branch_availability(text,text,uuid)  src/lib/branchAvailability.ts:32 (menü/checkout)
--   validate_coupon_v2(text,numeric,text,jsonb)  src/lib/offers.ts:77 (sepet, giriş öncesi)
--   vitrin_yorumlari(integer)  src/lib/socialProof.ts:17 (HomeScreen, giriş öncesi)
--   urun_begeni_oranlari(integer)  src/lib/socialProof.ts:38 (ProductDetail, giriş öncesi)
--   is_admin()  storage politikaları değerlendirmesi için (anon'da her zaman false,
--               veri sızdırmaz — bkz. 20261021132806)
--   campaign_has_targets(uuid)  20261022202322'de kasıtlı anon verildi ("uygulamada
--               kullanılıyor"); mevcut grep'te doğrudan .rpc çağrısı bulunamadı —
--               KIRMAMAK için dokunulmadı, sabah doğrulama maddesi (rapora bakınız).
-- Bu 6 fonksiyonun hepsinde `set search_path` zaten tanımlı (migration'larda doğrulandı).
--
-- Aşağıda anon'dan (ve public'ten) EXECUTE kaldırılıyor; gereken yerde authenticated
-- açıkça korunuyor. Hiçbir çalışan akış bu fonksiyonları anon ile çağırmıyor.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1–2) ERTELENDİ (3 Kas, canlı log kontrolü) ─────────────────────────────
-- Son 24 saatte canlıda en_iyi_yorumlar 36, validate_coupon (v1) 2 kez çağrılmış:
-- mağazadaki mevcut uygulama sürümü hâlâ bunları kullanıyor. Yeni sürüm yayılana
-- kadar yetkiler AYNEN kalıyor; yeni uygulama yayınlanıp eski sürüm kullanımı
-- sıfıra inince ayrı bir migration ile kaldırılacak.

-- ── 3) campaign_targets_me(uuid) — anon için anlamsız ──────────────────────
-- "Beni hedefliyor mu?" fonksiyonu auth.uid() gerektirir; anon'da kimlik yok,
-- dolayısıyla anon için işlevsiz. Repo'da tanımı ve çağrısı bulunamadı (canlıda var).
-- Anon'dan kaldırılıyor; giriş yapmış kullanıcı senaryosu için authenticated korunuyor.
revoke execute on function public.campaign_targets_me(uuid) from anon, public;
grant  execute on function public.campaign_targets_me(uuid) to authenticated;

-- ── 4) SECURITY DEFINER trigger fonksiyonlarında search_path sabitleme ─────
-- Advisor `function_search_path_mutable` (WARN) ile işaretledi. search_path'i
-- mutable olan bir SECURITY DEFINER fonksiyonu, arama yolu ele geçirilerek yetki
-- yükseltmeye açıktır. Aşağıdaki 3'ü SECURITY DEFINER + trigger ve search_path'siz
-- (migration'larda doğrulandı). ALTER FUNCTION yalnızca ayarı ekler, gövdeyi
-- değiştirmez (geri alınabilir). Bunlar trigger fonksiyonu olduğundan EXECUTE
-- yetkileri bu değişiklikten etkilenmez.
--   handle_new_user()            20260916230000_card_infra_security.sql:46
--   record_order_delivered_event() 20260916094149_analytics_events.sql:39
--   record_order_purchase_event()  20260916140000_purchase_event_is_free_flag.sql:11
alter function public.handle_new_user() set search_path = public;
alter function public.record_order_delivered_event() set search_path = public;
alter function public.record_order_purchase_event() set search_path = public;

commit;
