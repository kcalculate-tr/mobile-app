# G2-S2 — main ↔ feat/social-login birleştirme · LOG

> Dal: `night2/main-sync` (feat/social-login'den) · Başlangıç: 2026-11-02

## Özet (10 satır)
1. Dal: `night2/main-sync` (feat/social-login'den). main'in feat'te olmayan 25 commit'i tek tek sınıflandırıldı.
2. **Cherry-pick edilen commit sayısı = 0.** Hiçbiri "gerçekten eksik + güvenli" değil (gerekçeler altta + MAIN_SYNC raporunda).
3. **Grup A (3 revert):** sosyal-giriş serisini geri alıyor; feat'in canlı çekirdek özelliği → ALINMADI (feat'i bozardı).
4. **Grup B (11 kart/ödeme):** dokundukları edge-fn/migration feat'te aynı isimle + daha ileri var; almak gerileme → ALINMADI. Kanıt: `validate_coupon` → feat'te `validate_coupon_v2` (+card_alias).
5. **Grup C (11):** feat'te zaten patch-eşdeğeri var → yapılacak bir şey yok.
6. "main-only" ~60 dosya feat'in yeniden yapılanması (src/core, src/modules/eatkcal) + paytr'ın bilinçli silinmesi — kurtarılacak dosya değil.
7. night2/main-sync'e tek dokunuş: **2 test-altyapısı commit'i** (`0d6bed5`, `b2bed1b`). Üretim davranışı değişmedi.
8. Kontrol: `tsc --noEmit` 0 · `npm run test:unit` 294/294 · `npm run test:components` 4 suite/30 test · `expo export --platform ios` exit 0 → `/tmp/g2s2-export` (silinmedi).
9. **Bu 3 test + jest kurulumu feat/social-login'de de KIRIK** (restructure/icons fallout); sabah feat'e de alınmalı (ayrı PR).
10. **İlter sabah:** (a) sosyal-giriş main'e geri gelmesini onayla, (b) MAIN_SYNC'teki `merge -X theirs` adımlarıyla main'i eşitle + testleri tekrar koş, (c) admin-panel pointer `016cffe`'ye (daha yeni, ileri sarım) — teyit et.

---

## Yapılanlar (kronolojik)
1. Worktree `.claude/worktrees/g2-s2`, dal `night2/main-sync` feat/social-login'den açıldı; `npm ci` (lockfile) çalıştırıldı.
2. `git cherry -v feat/social-login main` → 25 commit; 14'ü `+` (eşdeğer yok görünür), 11'i `-` (feat'te var).
3. 14 `+` commit'in her dosyası `git diff main feat/social-login -- <yol>` ile karşılaştırıldı → 3'ü revert, 11'i eski kart/ödeme (feat daha ileri). Ayrıntı: MAIN_SYNC raporu.
4. Cherry-pick edilmedi (gerekçeli). Kontrol gate'i çalıştırıldı → 3 unit + 4 component test KIRIK çıktı (restructure sonrası eski yollar).
5. Test düzeltmeleri yapıldı (yalnız test/jest/script; üretim kodu değil):
   - `0d6bed5` kaynak yolları: PaymentScreen/CheckoutScreen → `src/modules/eatkcal/screens/`; paynkolayReturn import regex'i; jest.setup supabase `src/lib` → `src/core`.
   - `b2bed1b` jest `moduleNameMapper` (phosphor commonjs override) + `test:unit` `find|xargs tsx --test` (node 20 glob uyumu).
6. Yeniden kontrol: tsc 0 · test:unit 294/294 · test:components 30/30 · expo export iOS exit 0.
7. Rapor `docs/night/G2-S2-MAIN_SYNC.md` + bu LOG yazıldı; dal push edildi.

## Test gate — kök nedenler (hepsi PRE-EXISTING, feat'te de var)
- Node 20.20 `--test` glob'u genişletmiyor; `"src/**/__tests__/**/*.test.ts"` tırnaklı desen hiçbir kabukta açılmıyor → test:unit çalışmıyordu (main checkout'ta da doğrulandı).
- feat restructure (S2 madde 4/5, night/s2-mobile) ekranları taşıdı; 3 kaynak-tarayan test + jest.setup eski yolları gösteriyordu.
- 17.10 icons refactor + tsconfig phosphor `paths` (yalnız-tip) eşlemesini jest-expo çalışma zamanına da uygulayıp 4 bileşen testini kırmıştı.

## SORULAR
- (MAIN_SYNC "SORULAR" ile aynı) sosyal-giriş onayı · eşitleme yöntemi (merge vs reset --hard+force) · test düzeltmelerinin feat'e de alınması.

## Commit'ler (night2/main-sync, feat üzerine)
- `0d6bed5` test(gece-g2-s2): restructure sonrası eski kaynak yollarını güncelle
- `b2bed1b` test(gece-g2-s2): jest phosphor eşlemesi + test:unit node 20 uyumu
