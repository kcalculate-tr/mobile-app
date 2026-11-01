# S1 — Veri katmanı · LOG

## ÖZET (10 satır)
1. Dal `night/s1-data` (feat/social-login'den, worktree). 3 commit atıldı.
2. **Senkron:** canlıda olup repoda olmayan 20 migration kurtarıldı + 7 edge function çekildi (secret sızıntısı yok).
3. Repodaki 11 "fazla" migration aslında aynı işin farklı timestamp'li kopyası (db push drift'i) — tespit edildi.
4. **Şema:** 67 tablo + 1 view; tam döküm `S1-SCHEMA_DUMP.md`. Gerçek orphan: `user_credits`, `legal_documents` (+ uyuyan `push_notifications`).
5. Ağır legacy kolon birikimi `orders` (72 kolon), `products`, `profiles`, `addresses`, `campaigns` — refactor adayı, dokunulmadı.
6. **Advisors:** güvenlik 5 lint (RLS-no-policy 10, search_path 19, definer-exec anon 9/auth 37); performans 224 bulgu (initplan 115, FK index 24, permissive 57).
7. **Düzeltme migration'ları (+rollback):** 3a müsaitlik tek alan, 3b carts/cart_items+RLS, 3c FK index+çift constraint temizliği.
8. **Tracking taslağı:** ayrı `tracking` şeması (meal_entries, daily_goals, ai_requests) migration + tasarım notu `S1-TRACKING_SCHEMA.md`.
9. **main ayrışması:** cherry-pick hariç main'de eksik 38 backend commit (güvenlik fix'leri dahil) — yalnız tespit.
10. **KALAN:** migration'lar staging'de TEST EDİLMEDİ (staging MCP yok); geniş RLS/initplan sıkılaştırması ertelendi (öneri yazıldı); git/merge işlemi yapılmadı.

---

## Çalışma ortamı
- Dal: `night/s1-data` (feat/social-login'den, worktree: `.claude/worktrees/s1-data`)
- Canlı Supabase (`xtjakvinklthlvsfcncu`) salt-okunur, yalnızca `supabase-prod` MCP ile.
- **staging MCP oturumda YOK** → migration'lar yalnızca dosya olarak yazıldı, hiçbir yere uygulanmadı/test edilmedi.

## Commit'ler
- `1dcdc57` chore(senkron): 20 migration + 7 edge function repoya alındı
- `583d3ad` feat(db): S1 düzeltme migration'ları + tracking şeması taslağı
- (bu dosya + audit son hali ayrı commit)

## İlerleme

### 1. Repo ↔ canlı senkronu — TAMAM
- Canlıda olup repoda olmayan **20 migration** (20–27 Ekim) `supabase_migrations.schema_migrations`'tan kurtarılıp yazıldı.
- Repoda olup canlı geçmişinde olmayan **11 dosya** = aynı mantıksal migration'ların farklı timestamp'li kopyası (drift). Detay DB_AUDIT §1.2.
- Canlıda eksik **7 edge function** çekildi (`free-order-complete`, `macro-expiry`, `env-check`, `tosla-*`, `social-upload`, `reels-upload-url`). Inline secret yok.
- Repoda fazla/ölü: `notify-order-status` (trigger'a geçmiş), `env-check` (stub). → DB_AUDIT §1.1.

### 2. Şema denetimi — TAMAM
- 67 tablo + `order_financials` view. Tam döküm `S1-SCHEMA_DUMP.md`.
- Orphan + backend-only + legacy kolon analizi → DB_AUDIT §2.

### 3. Düzeltme migration'ları — TAMAM (dosya; test edilmedi)
- 3a `20261102000100_products_availability_unify`
- 3b `20261102000200_carts_and_cart_items`
- 3c `20261102000300_fk_indexes_and_dupe_cleanup`
- Her biri + `_rollback.sql`. Geniş RLS/initplan sıkılaştırması ertelendi (DB_AUDIT §5.3c-ertelenen).

### 4. Tracking şeması taslağı — TAMAM
- `20261102000400_tracking_schema` (+rollback) + tasarım notu `S1-TRACKING_SCHEMA.md`. Veri taşınmadı, uygulama kodu yok.

### 5. main ↔ feat/social-login ayrışması — TAMAM (tespit)
- Cherry-pick hariç main'de eksik **38 backend commit**. Detay DB_AUDIT §6. Git işlemi yapılmadı.

## SORULAR
- `user_credits` / `legal_documents` / `push_notifications` silinsin mi? (satır sayıları düşük; önce kullanılmadığı iş tarafında doğrulanmalı — DB_AUDIT §2.1–2.2)
- Geniş RLS initplan sıkılaştırması için staging erişimi sağlanabilir mi? (115 politika, test gerekli)
- `orders` 72-kolon legacy refactor'u ne zaman? (servis ayrışmasıyla mı — DB_AUDIT §2.4)
