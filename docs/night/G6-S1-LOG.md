# G6-S1 — Entegrasyon + sunucu boşlukları · LOG

Dal: **`night6/integration`** (taban `night5/base`, worktree `.claude/worktrees/g6-s1`). Uygulama planı: [G6-APPLY.md](./G6-APPLY.md).

## Özet (10 satır)
1. Dört G5 dalı `--no-ff` sırayla birleştirildi (feed-backend → day-rings → feed-client → share-links); tek çakışma `flags/registry.ts` (`paylasim_karti` tek kez, anahtarların birleşimi), navigator/types otomatik birleşti.
2. Migration sürüm çakışması giderildi: S1/S2/S4'ün aynı `20261103020000…` önekleri uygulama sırasına göre `20261104000100`'den 100'er artan benzersiz öneklere `git mv`'lendi (9 dosya). `profiles` kolonları tek yerde (profiles_social_columns); feed_tables'tan çift ALTER kaldırıldı.
3. TÜM `*_rollback.sql` (15, eskiler dahil) `supabase/rollbacks/` altına taşındı; `migrations/` klasöründe rollback kalmadı (`supabase db push` artık onları çalıştırmaz).
4. G6 düzeltme migration'ı `20261104001000_g6_fixes.sql`: `check_handle` (salt okur), `set_profile_privacy` (gizli→açık istek onayı), `get_public_profile` gerçek sayaçlar + `verified`=creators.verified_at + `me_following` enum/`me_requested`, `get_day_rings` takip edilenler, `check_delivery_city` {ok,reason}, moderasyon (`content_reports.status`→open/resolved + `risk`, `moderation_actions`, `mod_list_reports`, `mod_resolve_report`), `ai_scan_reservations` `consumed`.
5. Edge function `analyze-ai-scan/index.ts` (YALNIZ DOSYA) sözleşme biçiminde yazıldı; Anthropic Messages API görsel girdi, 20 sn timeout, JSON-dışı→502 {error:'parse'}, başarıda rezervasyon consumed. Anahtar yok, deploy yok.
6. İstemci hizalandı: `check_handle` eklendi (useHandleClaim artık rezerve etmeyen salt-okur kontrol), `PublicProfile.me_requested`, AI analiz çağrısı `analyze-ai-scan` + `{reservation_id,image_path}` + items/total→düz ScanEstimate map.
7. `feed_rls_test.sql`'e T11–T15 eklendi (check_handle salt okur, gizli→açık istek onayı, moderatör olmayan mod_* reddi, remove sonrası akıştan düşme). Çalıştırılmadı (yalnız dosya).
8. Kontroller: `tsc --noEmit` **0**, `npm run test:unit` **334/334**, `npx expo export --platform ios` **başarılı** (çıktı repo dışına, job tmp).
9. G6-APPLY.md: 10 migration + edge function sıralı liste. **`supabase db push` KULLANMA** uyarısı başta. Canlı MCP doğrulaması BLOKLANDI (bkz. SORULAR #5) — statüler kaynak çıkarımı.
10. Dal push edilmedi (RULES: PR yok). Bayrakların hepsi KAPALI → canlı davranış değişmez.

## Yapılanlar (commit'li)
- Merge'ler: `d1355fc` feed-backend · `335fba2` day-rings · `f6efe53` feed-client · `7e48558` share-links (registry çakışması çözüldü, tsc 0, 334/334).
- `4e42c29` migration benzersiz önekler + profiles kolon tekrarı tek yerde.
- `9326281` 15 `_rollback.sql` → `supabase/rollbacks/` (+ README).
- `85c38dd` G6 düzeltme migration'ı + profil istemci hizalama (check_handle, me_requested).
- `ae2c43d` analyze-ai-scan edge function + ai/scan istemci çağrı hizalama.
- `85f09c5` feed_rls_test T11–T15.
- `docs/night/G6-APPLY.md`, bu LOG — bu commit.

## Risk eşleme tablosu (`content_report_risk(reason)` → smallint 0–3)
G6-CONTRACT.md §Moderasyon gereği `content_reports.risk` serbest-metin `reason`'dan türetilir (regex, küçük harf):
| risk | eşleşen anahtarlar (regex) | anlam |
|------|----------------------------|-------|
| 3 | `csae\|child\|self.?harm\|intihar\|suicide\|siddet\|violence\|threat\|tehdit\|weapon\|silah` | can güvenliği / istismar / şiddet-tehdit |
| 2 | `nudity\|sexual\|cinsel\|porn\|hate\|nefret` | cinsel içerik / nefret söylemi |
| 1 | `harass\|taciz\|bully\|zorbalik\|abuse` | taciz / zorbalık |
| 0 | (diğer: spam, scam, misinfo, diger, other) | düşük öncelik |
`mod_list_reports` sırası: risk desc → created_at asc (en riskli + en eski açık şikayet önce).

## Kontrol sonuçları
- `npx tsc --noEmit` → **0 hata** (her merge sonrası ve bitişte).
- `npm run test:unit` → **tests 334 / pass 334 / fail 0**.
- `npx expo export --platform ios` → **başarılı** (iOS bundle, çıktı `$CLAUDE_JOB_DIR/tmp`, repoya girmedi).
- SQL/edge: çalıştırılmadı/deploy edilmedi (gece kuralı — yalnız dosya). `feed_rls_test.sql` staging'de koşulmalı.

## SORULAR (karar İlter'de)
1. **`me_following` tipi.** İstemci (`profil/types.ts`) `me_following`'i ENUM (`'following'|'requested'|'none'`) bekliyor; G6-CONTRACT bool + `me_requested` diyor. Sunucu istemciye uymak için enum döndürüyor VE ek olarak `me_requested` bool veriyor (üst küme). İstemci bool isterse tek satır değişir.
2. **`mod_resolve_report(p_report)` tipi.** G6-CONTRACT `uuid` yazıyor ama `content_reports.id` **bigserial** (feed_tables). `bigint` kullanıldı. Rapor id'si uuid olmalıysa content_reports PK'si değişmeli (invazif) — önerilmez.
3. **AI rezervasyon kimliği.** Sistemde ayrı `reservation_id uuid` yok; rezervasyon `ai_scan_reservations.idempotency_key` (text) ile anılıyor. Edge function `reservation_id` alanına bu anahtar gelir. Sözleşmedeki "uuid" semantik olarak bu anahtara karşılık geliyor.
4. **`AI_SCAN_MODEL` varsayılanı.** Edge function'da varsayılan `'claude-haiku-5-5'` (sözleşmedeki literal) — bu bir **yer tutucu**; geçerli/mevcut bir model kimliği olmayabilir. Deploy öncesi `supabase secrets set AI_SCAN_MODEL=<geçerli model>` ile ayarlanmalı.
5. **Canlı MCP doğrulaması BLOKLANDI.** G6-APPLY.md için salt-okur `supabase-prod` MCP ile "canlıda var mı?" kontrolü harness güvenlik sınıflandırıcısı tarafından reddedildi (kullanıcı prod okuma onayı vermemişti). APPLY statüleri dosya kaynağından çıkarım; uygulamadan önce doğrulama sorguları G6-APPLY.md'de — elle koşulmalı.
6. **day_card hedef kimliği.** `report_content('day_card', …)` ve `mod_list_reports` önizlemesi, hedef id'nin `day_shares.id` olduğunu varsayar (`get_day_cards`'ın döndürdüğü `id`). İstemci farklı bir id geçiriyorsa önizleme join'i güncellenmeli.
