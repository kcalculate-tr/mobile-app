# G2-S1 — Güvenlik Raporu (gece-2)

**Dal:** `night2/security` · **Tarih:** 2026-11-02/03 · **Kaynak:** Supabase prod `xtjakvinklthlvsfcncu` (yalnızca OKUMA, supabase-prod MCP)
**Migration'lar:** dosya olarak yazıldı, **HİÇBİR YERE UYGULANMADI**, **STAGING'DE TEST EDİLMEDİ**.

Her bulgu: **risk** · **etkilenen akış** · **öneri** · **referans (dosya:satır / tablo / advisor)**.

---

## 0. Özet tablo

| # | Bulgu | Risk | Durum |
|---|-------|------|-------|
| 1 | 10 tablo RLS açık + politikasız | Düşük (zaten reddediyor) | Migration yazıldı (0100) |
| 2 | 9 SECURITY DEFINER fn anon'a açık | Orta | 3'ü kısıtlandı (0200), 6'sı kasıtlı/korundu |
| 3 | 19 fn mutable `search_path` (WARN) | Orta (SD olanlar) | 3 SD trigger düzeltildi (0200); kalanı takip |
| 4 | **Git geçmişinde service_role JWT** | **Yüksek** | Rapor — anahtar rotasyonu gerek |
| 5 | tosla-callback imza doğrulaması yok | Yüksek (ama KAPALI) | Rapor — yeniden açılırsa düzelt |
| 6 | payment-verify `verify_jwt=false` + imza yok | Yüksek (ama KAPALI) | Rapor — yeniden açılırsa düzelt |
| 7 | social-media bucket public, yazma politikasız | Orta | Rapor — service_role varsayımı belgelensin |
| 8 | Leaked password protection kapalı | Düşük | Rapor — Dashboard'dan açılabilir |
| — | Paynkolay & Adisyo callback imzaları | OK | HMAC + timing-safe doğrulanıyor |
| — | Hassas dosyalar (.env, key, cert) | OK | Hepsi gitignore'da, takip edilmiyor |

---

## 1. RLS açık ama politikası olmayan 10 tablo — advisor `rls_enabled_no_policy`

**Risk: Düşük.** RLS açık + politika yok = PostgREST'te anon/authenticated için **zaten "hepsini reddet"**. service_role RLS'i baypas eder. Bu güvenli bir durum; advisor yalnızca "yanlışlıkla kilitlenmiş olabilir" diye bilgi (INFO) amaçlı işaretliyor.

**Etkilenen akış: Yok.** Kod taraması 10 tablonun **tamamına yalnızca service_role'lü edge function'lardan** erişildiğini gösterdi — mobil (src/), admin-panel/, branch-panel/ hiçbiri bu tablolara anon/authenticated ile dokunmuyor. `validate_coupon()` (SECURITY DEFINER) `deleted_account_fingerprints`'i okur ama definer bağlamında çalıştığı için çağıranın RLS'inden etkilenmez.

| Tablo | Yazan/okuyan (hepsi service_role) | Referans |
|-------|-----------------------------------|----------|
| adisyo_api_log | adisyo-webhook-receiver / -status-forward / -save-order | index.ts:365 / :202 / :459 |
| adisyo_webhook_events | adisyo-webhook-receiver | index.ts:151,192,284 |
| deleted_account_fingerprints | delete-account; validate_coupon() okur | delete-account/index.ts:145 |
| failed_payments | payment-verify, tosla-callback, paynkolay-cards, _shared | payment-verify/index.ts:124 |
| push_notifications | **YOK — 0 satır, kodda referansı yok (eski/ölü tablo)** | — |
| refunds | paynkolay-refund | paynkolay-refund/index.ts:230,271 |
| sweep_locks | acquire/release_sweep_lock() + pg_cron | 20260918160000_card_verification_sweep.sql:16 |
| user_apple_tokens | apple-link-token, delete-account | apple-link-token/index.ts:79 |
| user_card_secrets | paynkolay-cards, _shared/paynkolay-* | paynkolay-cards/index.ts:317,523,573,671 |
| user_known_devices | paynkolay-cards (3D "yeni cihaz" mantığı) | paynkolay-cards |

**Öneri:** Davranışı değiştirmeden niyeti kod olarak sabitlemek için her tabloya anon+authenticated için **açık "erişim yok"** (`using(false) with check(false)`) politikası eklendi. Bu, advisor uyarısını kapatır, yeni erişim AÇMAZ (en dar politika), çalışan hiçbir şeyi kırmaz (service_role baypas).
→ **`supabase/migrations/20261103000100_security_rls_policies.sql`** (+ `_rollback.sql`)

İleride bir ekran kullanıcıya KENDİ satırlarını göstermek isterse (ör. kendi kayıtlı cihazları), o tabloya ayrıca `using (user_id = auth.uid())` kapsamlı bir SELECT politikası eklenir. Bugün gerek yok.

---

## 2. Anon'un çalıştırabildiği 9 SECURITY DEFINER fonksiyonu — advisor `anon_security_definer_function_executable`

**Risk: Orta.** anon'un gereksiz SECURITY DEFINER fonksiyon çağırabilmesi saldırı yüzeyini genişletir. Her biri kodla değerlendirildi:

### Anon'da KALACAKLAR (giriş öncesi akışta gerçekten gerekli — dokunulmadı)
| Fonksiyon | Neden anon gerekli | Referans | search_path |
|-----------|--------------------|----------|-------------|
| fn_branch_availability(text,text,uuid) | Menü/checkout, giriş öncesi ürün tarama | src/lib/branchAvailability.ts:32 | var ✓ |
| validate_coupon_v2(text,numeric,text,jsonb) | Sepette kupon, giriş öncesi | src/lib/offers.ts:77 | var ✓ |
| vitrin_yorumlari(integer) | HomeScreen yorum şeridi, giriş öncesi | src/lib/socialProof.ts:17 | var ✓ |
| urun_begeni_oranlari(integer) | ProductDetail beğeni oranı, giriş öncesi | src/lib/socialProof.ts:38 | var ✓ |
| is_admin() | Storage politikaları değerlendirmesi; anon'da hep false, veri sızdırmaz | 20261021132806 | var ✓ |
| campaign_has_targets(uuid) | 20261022202322'de kasıtlı anon verildi ("uygulamada kullanılıyor") | 20261022202322:55 | — (bkz. not) |

> **campaign_has_targets notu (orta → doğrulanmalı):** Önceki oturum anon'a kasıtlı verdi ama mevcut grep'te `.rpc('campaign_has_targets')` doğrudan çağrısı bulunamadı. Kırmamak için DOKUNULMADI. **Sabah doğrula:** gerçekten kullanılmıyorsa `revoke execute on function public.campaign_has_targets(uuid) from anon, public;` eklenebilir.

### Anon'dan KALDIRILANLAR (migration 0200)
| Fonksiyon | Neden anon gereksiz | Referans | Aksiyon |
|-----------|---------------------|----------|---------|
| validate_coupon(text,numeric,text) | İstemci v2'yi çağırıyor; v1'i yalnızca free-order-complete KULLANICI JWT'siyle (authenticated) çağırıyor | free-order-complete/index.ts:54 | revoke anon+public, grant authenticated |
| en_iyi_yorumlar(integer) | Kullanımdan kalktı; vitrin_yorumlari yerine geçti, hiç çağrısı yok | — (grep boş) | revoke anon+authenticated+public |
| campaign_targets_me(uuid) | auth.uid() gerektirir; anon'da anlamsız. Repo'da tanımı/çağrısı yok | advisor (canlıda var) | revoke anon+public, grant authenticated |

→ **`supabase/migrations/20261103000200_function_grants.sql`** (+ `_rollback.sql`)

> **authenticated SECURITY DEFINER (37 adet, advisor `0029`) — bilgi:** Bunların çoğu trigger fonksiyonu; önceki oturum (20261022202322) zaten anon/public'ten kaldırmış, authenticated'da bırakmıştı. Trigger fonksiyonlarının authenticated'tan da kaldırılması düşük riskli bir ileri adımdır ama bu oturumun kapsamı (anon) dışında bırakıldı.

---

## 3. Mutable `search_path` — advisor `function_search_path_mutable` (WARN, 19 fonksiyon)

**Risk: SECURITY DEFINER olanlarda orta, diğerlerinde düşük/hijyen.** Mutable search_path'li bir SECURITY DEFINER fonksiyonu, arama yolu ele geçirilerek yetki yükseltmeye açıktır. SECURITY INVOKER fonksiyonlarda risk ihmal edilebilir (çağıran bağlamında çalışır).

**Bu oturumda düzeltilenler (0200):** Repo migration'larında tanımı + SECURITY DEFINER + search_path'siz olduğu DOĞRULANAN 3 trigger fonksiyonu. `ALTER FUNCTION ... SET search_path = public` gövdeyi değiştirmez, geri alınabilir:
- `handle_new_user()` — 20260916230000_card_infra_security.sql:46
- `record_order_delivered_event()` — 20260916094149_analytics_events.sql:39
- `record_order_purchase_event()` — 20260916140000_purchase_event_is_free_flag.sql:11

**Takibe bırakılanlar (öneri):** Advisor'daki kalan ~16 fonksiyonun bir kısmının tanımı repo migration'larında YOK (canlıda var, Dashboard'dan eklenmiş olabilir); imzaları doğrulanamadığı için tahminle `ALTER` yazılmadı (gece kuralı: tahmin yok). Sabah bunlar için canlıdan imza alınıp toplu bir `ALTER FUNCTION ... SET search_path = public` migration'ı yazılabilir. Öncelik SECURITY DEFINER olanlar: `record_campaign_use`, `fn_notify_adisyo_save_order`, `generate_payment_customer_key`, `fn_set_branch_product_availability(uuid,bigint,boolean)`. Trigger/INVOKER olan `update_updated_at`, `touch_updated_at`, `kcal_norm_ad(text)` vb. düşük öncelikli hijyen.

---

## 4. Git geçmişinde service_role JWT — **YÜKSEK**

**Risk: Yüksek.** service_role anahtarı tüm RLS'i baypas eder, tüm kullanıcı verisine erişir.
**Etkilenen akış:** Depoya erişen herkes anahtarı git geçmişinden çıkarabilir.
**Referans (değer YAZILMADI):** `tools/adisyo-prices/setup-adisyo-trigger.sql:32` — proje `xtjakvinklthlvsfcncu` service_role JWT'si. İlk commit `2c75997` (2026-06-10). Dosya `.sql` olduğu için gitignore kapsamında değil.
**Öneri:**
1. **Supabase Dashboard'dan service_role anahtarını ROTE ET** (en acil; bunu bu oturum yapamaz).
2. Dosyadaki değeri kaldır, yerine Vault'tan okuma yönergesi/placeholder bırak.
3. Geçmişten temizleme (filter-repo) ağır ve riskli; anahtar zaten rote edilince teşhir değeri kalmaz — önce rotasyon.

---

## 5. Edge function JWT doğrulaması

`supabase/config.toml` + fonksiyon gövdeleri tarandı. **Çoğu güvenli.** İki açık nokta var ama ikisi de şu an KAPALI:

| Fonksiyon | verify_jwt | Durum / Not | Risk |
|-----------|-----------|-------------|------|
| payment-init / paynkolay-payment-init | true | Kullanıcının siparişi sahip olması doğrulanıyor | OK |
| send-notification | true | Ayrıca role claim (service_role/admin) kontrolü | OK |
| delete-account | true | auth.uid() sahiplik kontrolü | OK |
| free-order-complete | (varsayılan true) | auth header + sipariş sahipliği | OK |
| **payment-verify** | **false** | Tosla callback'i; **imza doğrulaması YOK**. Şu an KAPALI (index.ts:19 → 410) | **Yüksek (yeniden açılırsa)** |
| paynkolay-callback | false | Webhook; **HMAC-SHA512 + timing-safe DOĞRULANIYOR** | OK |
| adisyo-webhook-receiver | false | Webhook; **HMAC-SHA256 + timing-safe DOĞRULANIYOR** | OK |

---

## 6. Ödeme callback imza doğrulaması

- **Paynkolay (OK):** `_shared/paynkolay-cards.ts:376-381` — SHA-512 base64 hash, `constantTimeEqual` (sabit-zaman) ile karşılaştırılıyor; geçersizse sipariş değişmiyor. **Düşük risk.**
- **Adisyo (OK):** `adisyo-webhook-receiver/index.ts:114-129` — HMAC-SHA256, `timingSafeEqualStr`; geçersiz imza `signature_valid=false` kaydedilip işlenmiyor. **Düşük risk.**
- **Tosla (YÜKSEK, ama KAPALI):** `tosla-callback/index.ts` — **hiç imza/HMAC doğrulaması yok**. Şu an 410 ile kapalı (index.ts:17-22). Yeniden açılırsa `BankResponseCode=00` içeren SAHTE bir callback herhangi bir siparişi "ödendi" yapabilir.
  **Öneri:** Tosla yeniden açılmadan önce HMAC imza doğrulaması eklenmeli ve `verify_jwt` kararı gözden geçirilmeli.

---

## 7. Storage bucket politikaları

| Bucket | Public | Politika | Risk |
|--------|--------|----------|------|
| public-assets | evet | SELECT public; yazma authenticated+is_admin() | Düşük |
| support-attachments | evet | INSERT authenticated (yalnız `tickets/{user_id}/`); DELETE admin | Düşük |
| **social-media** | evet | **INSERT/UPDATE/DELETE politikası YOK** — yazma yalnız service_role baypasına dayanıyor | **Orta** |
| platform-metrics | hayır | SELECT authenticated+is_admin(); yazma service_role | Düşük |
| avatars | (public select) | yazma yalnız kendi dosyası `{user_id}.*` | Düşük |
| images | evet | SELECT public; yazma authenticated+is_admin() | Düşük |

**Referans:** `20261021132735_storage_public_assets_and_support_attachments.sql`, `20261021133946_create_social_media_bucket.sql:5-7`, `20261023171345_platform_metrics_storage_and_tables.sql:17-25`, `20261021132721_storage_policy_hardening.sql:19-49`.
**Öneri (social-media):** Yazmanın yalnızca service_role ile yapıldığı varsayımı migration yorumunda açıkça belgelensin; istemci tarafı bir yükleme yolu eklenirse `using (false)` yerine kapsamlı bir INSERT politikası tanımlansın.

## 8. Leaked password protection kapalı (advisor WARN)

**Risk: Düşük.** HaveIBeenPwned kontrolü kapalı; sızdırılmış parolalarla kayıt engellenmiyor.
**Öneri:** Supabase Dashboard → Auth → Password → "Leaked password protection" açılabilir. (ONAYSIZ YASAK listesinde "Dashboard auth ayarı değişikliği" var → **İlter'in onayıyla**.)

## Secret/dosya hijyeni (OK)

`.gitignore` kontrol edildi: `google-play-key.json` (satır 77), `google-services.json` (49,54), `*.p8` (15,96), `*.pem` (30), `*.p12` (16), `*.jks` (14), `.env*` (32,56-62) — hepsi ignore'da ve git'te **takip edilmiyor**. Tek istisna bölüm 4'teki `.sql` içindeki gömülü JWT.

---

## SABAH — İlter için SQL Editor adımları (sırayla)

> Hepsi önce **staging'de** denenmeli; prod'a canlı trafik düşükken uygulanmalı. Her migration kendi `begin;/commit;` bloğunda.

1. **(Acil, SQL değil) service_role anahtarını rote et** — Dashboard → Settings → API → service_role → Roll. Sonra `tools/adisyo-prices/setup-adisyo-trigger.sql:32`'deki değeri placeholder ile değiştir.
2. **Migration 0100 — RLS politikaları.** `20261103000100_security_rls_policies.sql` içeriğini çalıştır. Doğrula: advisor'da `rls_enabled_no_policy` 10 → 0. Uygulama akışları (menü, sipariş, ödeme, panel) etkilenmemeli (davranış aynı). Sorun olursa `20261103000100_security_rls_policies_rollback.sql`.
3. **Migration 0200 — fonksiyon yetkileri + search_path.** `20261103000200_function_grants.sql` çalıştır. Doğrula:
   - anon ile `validate_coupon`, `en_iyi_yorumlar`, `campaign_targets_me` artık çağrılamamalı (403).
   - Giriş öncesi akışlar çalışmaya devam: menü (fn_branch_availability), sepet kuponu (validate_coupon_v2), ana ekran/ürün yorumları (vitrin_yorumlari, urun_begeni_oranlari).
   - free-order-complete (bedava sipariş) hâlâ çalışmalı (authenticated validate_coupon).
   - Sorun olursa `..._rollback.sql`.
4. **campaign_has_targets kullanımını doğrula** (bölüm 2 notu). Gerçekten kullanılmıyorsa anon revoke ekle.
5. **(İsteğe bağlı) kalan mutable search_path fonksiyonları** (bölüm 3): canlıdan imzaları al, SECURITY DEFINER olanlar öncelikli, toplu `ALTER FUNCTION ... SET search_path = public` migration'ı yaz.
6. **(Onayla) Leaked password protection** — Dashboard → Auth. (Dashboard auth değişikliği onay gerektirir.)
7. **Tosla yeniden açılacaksa** (bugün değil): tosla-callback'e HMAC imza doğrulaması eklenmeden açma.
