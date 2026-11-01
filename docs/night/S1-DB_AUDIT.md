# S1 — Veritabanı Denetim Raporu

**Proje:** Kcalculate (Supabase `xtjakvinklthlvsfcncu`)
**Tarih:** 2026-11-02
**Dal:** `night/s1-data` (feat/social-login'den)
**Erişim:** Canlı DB salt-okunur (`supabase-prod` MCP). staging MCP oturumda yok → migration'lar **test edilmedi**, yalnızca dosya olarak yazıldı.

Her bulguda: **Etki** (Yüksek/Orta/Düşük) · **Efor** (S/M/L) · **Öneri** (Düzelt/Ertele/Sil) · **Referans**.

---

## 1. Repo ↔ Canlı Senkronu

### 1.1 Edge Functions — repoya eklendi
Canlıda 28 fonksiyon aktif; repoda 22 vardı (+`notify-order-status` repoda fazla). Canlıda olup repoda olmayan **7 fonksiyon** kaynağı `get_edge_function` ile çekilip `supabase/functions/<slug>/` altına yazıldı:

| Fonksiyon | verify_jwt | Not |
|---|---|---|
| `free-order-complete` | true | Ücretsiz (0 TL) öğün tamamlama |
| `macro-expiry` | true | Günlük cron (jobid 1, `0 3 * * *`) çağırıyor |
| `env-check` | true | Devre dışı stub (184 byte) |
| `tosla-payment-init` | true | Tosla yedek ödeme — davranış değiştirilmedi |
| `tosla-callback` | false | Tosla yedek ödeme callback |
| `social-upload` | false | `TOKEN_SHA256` header doğrulaması (hash, secret değil) |
| `reels-upload-url` | false | `TOKEN_SHA256` header doğrulaması (hash, secret değil) |

- **Repoda fazla olan `notify-order-status`**: canlı fonksiyon listesinde yok. Sipariş durum bildirimi artık DB trigger `trg_notify_order_status_change` → `notify_order_status_change()` + `send-notification` üzerinden gidiyor. → **Etki: Düşük · Efor: S · Öneri: Sil** (ölü fonksiyon dizini; `supabase/functions/notify-order-status`). Ref: trigger listesi §4.
- **`env-check`** canlıda aktif ama stub → **Etki: Düşük · Efor: S · Öneri: Sil** (kullanılmıyor).
- Not: `ab68a2b` ile PayTR fonksiyonları (`paytr-*`) repodan kaldırılmış; canlıda da yok. Tutarlı.

### 1.2 Migration geçmişi farkı

**(a) Canlıda var, repoda yoktu → kurtarıldı (20 migration, 20–27 Ekim).**
Canlı migration geçmişinden (`supabase_migrations.schema_migrations.statements`) SQL kurtarılıp `supabase/migrations/` altına eklendi:

`settings_store_info_columns`, `boss_funnel_analytics`, `boss_funnel_last_touch_attribution`, `boss_funnel_no_temp_tables`, `boss_funnel_six_stages_monotonic`, `push_cart_abandoned_5min`, `rpc_yetki_sikilastirma_anon`, `storage_policy_hardening`, `storage_public_assets_and_support_attachments`, `is_admin_anon_execute_for_storage_policies`, `rls_permissive_policy_hardening`, `feedback_admin_read`, `fn_order_staff_yetkisi`, `create_social_media_bucket`, `trigger_fonksiyonlari_rpc_kapatma`, `platform_metrics_storage_and_tables`, `orders_adisyo_web_order_suffix`, `feedback_vitrin_onayi`, `vitrin_yorumlari_birlesik`, `fn_ad_maskele_bas_harf_buyut`.

> Bu dosyalar canlı version string'leriyle yazıldı; ileride `supabase db push` bunları "zaten uygulanmış" görüp atlar (yeniden uygulama riski yok). → **Etki: Orta · Efor: M · Öneri: Düzelt (commit'le)**.

**(b) Repoda var, canlı geçmişinde yok (11 dosya) — timestamp drift'i.**
Bunlar **yeni migration değil**; aynı mantıksal migration'ların repo'daki farklı timestamp'li kopyaları. `supabase db push` canlıya uygularken yeniden damgalamış:

| Repo dosyası | Canlıdaki karşılığı |
|---|---|
| `20260921180500_review_item_feedback` | `20260921173155_review_item_feedback` |
| `20260921193000_settings_review_banner_url` | `20260921195348_settings_review_banner_url` |
| `20260922100000_macro_model_v2` | `20260922173006_..._schema_and_lockdown` (bölünmüş) |
| `20260922110000_macro_engine_guard_bypass` | `20260922174201_macro_engine_bypass_for_profiles_guard` |
| `20260923120000_macro_reward_killswitch_and_rpc_lockdown` | `20260923124848_...` |
| `20260930090000_sube_hizmet_bolgeleri_ilk_esleme` | `20260930090631_...` |
| `20261001100000_teslimat_bolgeleri_mahalle_duzenlemesi` | `20261001080522_...` |
| `20261013141500_orders_external_unique_full` | `20261013141401_...` |
| `20261013142800_marketplace_auto_accept` | `20261013141817_...` |
| `20261013144500_trendyolgo_push_security_definer` | `20261013144204_...` |
| `20261014084500_branch_product_adisyo` | `20261014101730_...` |

→ **Etki: Orta · Efor: M · Öneri: Ertele** — İçerik canlıda var, işlevsel boşluk değil. Ama `supabase migration repair` ile repo dosya adları canlı version string'lerine hizalanmazsa, temiz bir makinede `db push` bu 11'i "yeni" sanıp **tekrar uygulamaya** çalışır (çoğu idempotent değil → hata). Düzeltme ayrı bir bakım işi; bu gece sadece tespit. Ref: `comm -13` çıktısı.

---

## 2. Şema Denetimi

> _(Doldurulacak: tablo/kolon envanteri, orphan tablolar, backend-only tablolar — schema_dump.md temelli.)_

---

## 3. Advisors (Güvenlik + Performans)

### 3.1 Güvenlik advisors

| Lint | Seviye | Adet | Özet |
|---|---|---|---|
| `rls_enabled_no_policy` | INFO | 10 | RLS açık ama politika yok (erişim tümden kapalı) |
| `function_search_path_mutable` | WARN | 19 | `search_path` sabitlenmemiş fonksiyonlar |
| `anon_security_definer_function_executable` | WARN | 9 | `anon` çağırabilen SECURITY DEFINER RPC |
| `authenticated_security_definer_function_executable` | WARN | 37 | Giriş yapmışların çağırabildiği SECURITY DEFINER RPC |
| `auth_leaked_password_protection` | WARN | 1 | HaveIBeenPwned kontrolü kapalı (Dashboard — ONAYSIZ, dokunulmadı) |

**`rls_enabled_no_policy` (10 tablo):** `adisyo_api_log`, `adisyo_webhook_events`, `deleted_account_fingerprints`, `failed_payments`, `push_notifications`, `refunds`, `sweep_locks`, `user_apple_tokens`, `user_card_secrets`, `user_known_devices`.
RLS açık + politika yok = yalnızca `service_role` erişebilir (anon/authenticated tümden kapalı). Bu tablolar hassas (kart sırları, iade, cihaz parmak izi) olduğundan **bilinçli kilitleme** olması muhtemel — ama advisor'ın işaretlemesi, niyetin açık olmadığını gösteriyor.
→ **Etki: Düşük (fiili olarak güvenli) · Efor: S · Öneri: Düzelt** — her tabloya açık bir `service_role_only` yorum/politika ekleyerek niyeti belgele; `user_apple_tokens`, `user_card_secrets`, `user_known_devices` için "yalnızca kendi kaydı" gerekiyorsa gözden geçir. Ref: security advisor 0008.

**`function_search_path_mutable` (19 fonksiyon):** `update_template_updated_at`, `handle_new_user`, `update_updated_at`, `kcal_norm_ad`, `enforce_hero_grid_size`, `touch_updated_at`, `map_order_status_to_template_key`, `fn_addresses_reset_verification`, `update_product_options_updated_at`, `card_verifications_touch_updated_at`, `fn_review_push_tani`, `fn_check_stuck_orders`, `fn_notify_new_order`, `generate_payment_customer_key`, `fn_set_branch_product_availability`, `fn_notify_adisyo_save_order`, `record_campaign_use`, `record_order_delivered_event`, `record_order_purchase_event`.
→ **Etki: Orta (SECURITY DEFINER olanlarda search_path enjeksiyonu riski) · Efor: S · Öneri: Düzelt** — hepsine `ALTER FUNCTION ... SET search_path = public, pg_temp` ekle. Geriye uyumlu, tek migration. Ref: security advisor 0011.

**`anon_security_definer_function_executable` (9):** `campaign_has_targets`, `campaign_targets_me`, `en_iyi_yorumlar`, `fn_branch_availability`, `is_admin`, `urun_begeni_oranlari`, `validate_coupon`, `validate_coupon_v2`, `vitrin_yorumlari`.
Çoğu bilinçli public (vitrin yorumları, kupon doğrulama, şube müsaitliği giriş öncesi gerekli). **`is_admin()` anon'a açık olması** dikkat çekici — tek başına tehlikesiz (false döner) ama gereksiz.
→ **Etki: Orta · Efor: M · Öneri: Düzelt** — gerçekten public gerekenler (`validate_coupon*`, `vitrin_*`, `fn_branch_availability`, `en_iyi_yorumlar`, `urun_begeni_oranlari`) kalsın; `campaign_*` ve `is_admin` için anon EXECUTE revoke et. Ref: security advisor 0028.

**`authenticated_security_definer_function_executable` (37):** boss_* paneli RPC'leri, trigger fonksiyonları (RPC olarak da çağrılabilir durumda), record_* vb. Trigger fonksiyonlarının REST/RPC üzerinden çağrılabilir olması gereksiz yüzey. `boss_*` fonksiyonları admin paneline ait ama `authenticated` herkese açık (içeride `is_admin` kontrolü varsa güvenli).
→ **Etki: Orta · Efor: M · Öneri: Düzelt** — trigger-amaçlı fonksiyonlardan (`fn_notify_*`, `fn_assign_order_branch`, `orders_guard_*`, `profiles_guard_*`, `record_*`, `notify_order_status_change`, `fn_trendyolgo_push_status`, `fn_orders_branch_stock_guard`, `fn_log_branch_assignment`, `fn_reviews_reply_guard`, `rls_auto_enable`, `grant_macros_on_delivery`, `create_notification_preferences_for_user`, `sync_profile_from_user_metadata`) `authenticated`/`anon` EXECUTE revoke et (trigger yine çalışır, DEFINER olarak). `boss_*` içinde `is_admin()` guard'ı doğrula. Ref: security advisor 0029.

**`auth_leaked_password_protection`:** Dashboard ayarı. CLAUDE.md "Dashboard auth ayarları ONAYSIZ" → **dokunulmadı**. → **Öneri: Ertele (onayla aç)**.

### 3.2 Performans advisors (toplam 224 bulgu)

| Lint | Seviye | Adet | Öneri |
|---|---|---|---|
| `unindexed_foreign_keys` | INFO | 24 | Düzelt (seçili) |
| `auth_rls_initplan` | WARN | 115 | Düzelt |
| `unused_index` | INFO | 26 | Ertele/Sil (seçili) |
| `multiple_permissive_policies` | WARN | 57 | Düzelt |
| `duplicate_index` | WARN | 1 | Sil |
| `auth_db_connections_absolute` | INFO | 1 | Ertele (Dashboard) |

**`unindexed_foreign_keys` (24):** FK var ama kapsayan index yok → JOIN/silme yavaş. Yüksek trafikli olanlar öncelikli: `orders.orders_branch_id_fkey`, `orders.orders_address_id_fkey`, `meal_logs.meal_logs_user_id_fkey`, `macro_transactions.macro_transactions_user_id_fkey`, `feedback.feedback_user_id_fkey`, `support_tickets.support_tickets_user_id_fkey`, `refunds.refunds_order_id_fkey`, `campaign_uses.campaign_uses_order_id_fkey`, `profiles.profiles_branch_id_fkey`, `review_item_feedback.*` (2), `marketplace_stores.marketplace_stores_branch_id_fkey`, `branch_product_adisyo.*`, `branch_users.branch_users_branch_id_fkey`, `categories.categories_parent_id_fkey`, `option_items.option_items_linked_product_id_fkey`, `product_option_groups.*` (2), `subscription_plans.*`, `notification_campaigns.*`, `adisyo_webhook_events.*`, `branch_assignment_log.*` (3).
→ **Etki: Orta · Efor: S · Öneri: Düzelt** — sık sorgulanan FK'lere index (migration 3c). Düşük hacimli log tablolarını (branch_assignment_log, adisyo_webhook_events) atlayabiliriz. Ref: performance advisor 0001.

**`auth_rls_initplan` (115 politika):** RLS'te `auth.uid()`/`current_setting()` her satırda yeniden çalışıyor → `(select auth.uid())` sarmalıyla satır başına bir kez hesaplanır. 40+ tabloyu kapsıyor (addresses, orders, order_items, reviews, meal_consumptions, user_nutrition_profiles, notification_*, profiles, support_tickets, …).
→ **Etki: Yüksek (büyük tablolarda okuma maliyeti) · Efor: L · Öneri: Düzelt** — mekanik ama geniş; politikaları yeniden yazan tek migration. Ref: performance advisor 0003.

**`multiple_permissive_policies` (57):** Aynı tablo+rol+aksiyon için birden çok PERMISSIVE politika → her sorguda hepsi değerlendiriliyor. Kök neden: admin-write politikaları aksiyon/rol kısıtı olmadan public-read ile çakışıyor (özellikle `settings`, `profiles`, `app_banners`, `banners`, `announcement_strip`, `popups` — 6 rol × tekrar). → **Etki: Orta · Efor: M · Öneri: Düzelt** — admin-write politikalarına `AS RESTRICTIVE` veya aksiyon-özel (`FOR INSERT/UPDATE/DELETE`) kısıt. Ref: performance advisor 0006.

**`duplicate_index` (1):** `product_option_groups` → `product_option_groups_product_id_group_id_key` ve `product_option_groups_unique_product_group` aynı. → **Etki: Düşük · Efor: S · Öneri: Sil** (birini bırak). Ref: 0009.

**`unused_index` (26):** Hiç kullanılmamış index'ler (bkz. ek liste S1-LOG). → **Etki: Düşük · Efor: S · Öneri: Ertele** — canlı istatistik penceresi kısa olabilir; silmeden önce birkaç hafta `pg_stat_user_indexes` izlenmeli. Yeni/az trafikli tablolardaki index'ler (review_item_feedback, metrics_actions, feedback_vitrin) henüz "kullanılmamış" görünebilir. Ref: 0005.

---

## 4. Trigger'lar ve pg_cron İşleri

### 4.1 pg_cron işleri (12 iş)
| jobid | ad | schedule | aktif | hedef |
|---|---|---|---|---|
| 1 | macro-expiry-daily | `0 3 * * *` | ✓ | `macro-expiry` fn |
| 2 | push-campaign-dispatcher | `* * * * *` | ✓ | `send-notification` fn |
| 3 | push-macro-reminder | `0 17 * * *` | ✓ | inline DO (profiles) |
| 4 | push-coupon-expiring | `0 7 * * *` | ✓ | inline DO |
| 5 | push-inactive-user | `0 11 * * 1` | ✓ | inline DO (auth.users) |
| 6 | adisyo-retry-failed | `*/1 * * * *` | ✓ | orders retry UPDATE |
| 7 | expire-abandoned-orders | `*/5 * * * *` | ✓ | orders expire UPDATE |
| 8 | check-stuck-orders | `*/2 * * * *` | ✓ | `fn_check_stuck_orders()` |
| 10 | paynkolay-review-sweep | `*/5 * * * *` | ✓ | `paynkolay-review-sweep` fn |
| 12 | card-verification-sweep | `*/5 * * * *` | ✓ | `paynkolay-verification-sweep` fn |
| 13 | push-order-feedback | `*/10 * * * *` | ✓ | inline DO (orders) |
| 15 | trendyolgo-poll | `* * * * *` | **✗ pasif** | `trendyolgo-poll` fn |
| 16 | push-cart-abandoned | `*/2 * * * *` | ✓ | `fn_push_cart_abandoned()` |

- **jobid 15 (trendyolgo-poll) pasif** — Trendyol GO poll entegrasyonu şu an kapalı. → Tespit; kararı işletme verir.
- jobid 2 (`push-campaign-dispatcher`) **dakikada bir** `send-notification` çağırıyor; boş çalışsa bile dakikada 1 invocation. İzlenmeli (maliyet). → **Etki: Düşük · Efor: S · Öneri: Ertele**.

### 4.2 Trigger'lar (public)
`orders` tablosunda **15 trigger** yoğunlaşmış (record_campaign_use, record_order_delivered_event, record_order_purchase_event, updated_at, grant_macros_on_delivery, notify_adisyo_save_order, notify_new_order, notify_order_status_change, assign_branch ×2, guard_insert, guard_protected_cols, log_branch_assignment ×2, stock_guard_insert, trendyolgo_push_status). Insert başına çok sayıda DEFINER fonksiyon çalışıyor.
→ **Etki: Orta (insert gecikmesi + bakım karmaşası) · Efor: L · Öneri: Ertele** — işlevsel sorun yok; ayrışma (eatkcal) sırasında konsolidasyon düşünülmeli. Diğer trigger'lar standart `touch_updated_at`/guard kalıpları.

---

## 5. Düzeltme Migration'ları

> _(Doldurulacak: 3a müsaitlik bayrağı birleştirme, 3b carts/cart_items, 3c index+RLS — her biri + rollback.)_

---

## 6. main ↔ feat/social-login Ayrışması (yalnızca tespit)

- Canlı kod `feat/social-login`'de; `main` 25 commit'i kendinde barındırıyor ama bunların 22'si feat'ten **cherry-pick** (CLAUDE.md gereği backend commit'leri main'e cherry-pick ediliyor).
- Patch-id karşılaştırmasıyla (`git log --cherry-pick --right-only main...feat/social-login -- supabase/`) **main'de eşdeğeri olmayan 38 backend commit** bulundu. Main'in en son cherry-pick'lediği backend işi "card aşama 6/6"ya denk geliyor; ondan **sonraki tüm backend işi main'de yok**:

**Trendyol GO / pazaryeri (8):** `ad10396` çift yönlü entegrasyon, `ba91704` orders dış kanal alanları, `02fed04` oto-kabul+poll, `fc265fe` ON CONFLICT fix, `65df4b3` kurye tutar fix, `ffcacf9` push trigger fix, `55ba804` şube stok migration'ları, `745601e` Bayraklı Adisyo/iade fix.
**Adisyo (4):** `6279144` şube bazlı hesap/eşleme, `cc05479` resolvePaymentMethodId 500 fix, `31a27c8` adisyo-debug, `9e624f0` GRAMAJ+yorum vitrini.
**Güvenlik (4):** `857d39a` send-notification yetki açığı, `1db065a` adisyo-status-forward yetki, `ce8081d` ücretsiz öğün emniyet+RPC kapatma, `d9cfc20` admin destek RLS + products yazma.
**Push/bildirim (2):** `2370815` N+1 kaldırma, `45f0502` 7 Ekim'den beri bildirim gitmiyordu fix.
**Ödeme (2):** `ab68a2b` PayTR kaldırma, `0f9a4c4` validate_coupon_v2 geçişi.
**Macro (2):** `0e99943` model v2, `416f9f2` profiles_guard kilit fix.
**Teslimat/şube (2):** `69e3500` mahalle düzeyi+Konak, `7c8270e` hizmet bölgesi eşlemesi.
**Feedback (2):** `b8ec1dd` ürün bazında beğeni, `c12f190` review pop-up görseli.
**Checkout/orders/UI (4):** `aeee05e` teslimat süresi+canlı takip, `150d32c` kart adı/Troy/görseller, `30aaa8e` tasarım turu, `adaba13` işletme bildirimi + 0 TL sponsor.
**Destek (2):** `c2c1950` yanıt e-postası, `d23542f` SSS düzeltme.
**Coupon (1):** `0706f9f` ilk-sipariş ödenmemiş taslak.
**Cards artçı (5):** `d354425`, `9e1156d`, `f2ff9f1`, `735cdfd` (deno.lock takip temizliği), + ilgili.

→ **Etki: Yüksek (main canlının ~1 ay gerisinde, güvenlik düzeltmeleri dahil) · Efor: M · Öneri: Düzelt** — backend commit'leri main'e cherry-pick sürekliliği sağlanmalı. **Bu gece git işlemi yapılmadı (yalnızca tespit).**

---

## Özet öneri sıralaması
1. **Yüksek:** `auth_rls_initplan` (115) düzelt · main'e eksik 38 backend commit (güvenlik fix'leri dahil).
2. **Orta:** migration timestamp drift repair · SECURITY DEFINER EXECUTE revoke · unindexed FK index'leri · multiple_permissive_policies · function search_path.
3. **Düşük:** unused_index izle-sonra-sil · duplicate_index sil · ölü fonksiyon dizinleri (`notify-order-status`, `env-check`) sil.
