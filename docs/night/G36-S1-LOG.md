# G36-S1 LOG — G33 + G34 açık soru kararları (12 Kas)

## ÖZET
1. Worktree `g36-s1`, dal `night36/kararlar` (taban `release/1.1.0`). Yalnız JS/TS + migration/edge DOSYASI → OTA; yeni paket yok; deploy / OTA / canlı DB yazma yok.
2. Kod değişikliği isteyen 7 karar uygulandı: md.4, md.5, md.8, md.11, md.12, md.13, md.14. md.1/2/3/6/7/9/10 "değişiklik yok" (mevcut davranış korunur).
3. md.8 migration'ı G35 ile aynı numarayı (`20261112120100`) kullanıyordu → `git mv` ile **`20261112130100_g36_personal_plan_consent.sql`** (+ rollback) olarak yeniden adlandırıldı; `policy.ts` ve test referansları güncel. G35'ten sonra uygulanır.
4. Nokta ayracı kuralı: sepet özet bildirimi ve kırpma alt satırı `·` yerine virgül (TR/EN + test).
5. md.13 `coach-chat` değişti (plan.ts + prompt.ts + index.ts) → **DEPLOY İlter** (aşağıda).
6. Kontroller `night36/kararlar` üzerinde: hygiene + tsc ✅ · unit 1247/1248 ✅ (1 atlanan: `dist/` yoksa vitrin testi) · jest 99 suite / 578 test ✅ · deno check coach-chat ✅ · expo export iOS ✅ · Android ✅.
7. `release/1.1.0`'a `git merge --no-ff night36/kararlar` — **çakışma yok** (G35 `release/1.1.0`'da 4b3100e; birleştirme `g23-s1` worktree'sinde, önceki oturumlar gibi). force/reset yok.
8. Kontroller `release/1.1.0` (751b0f7) üzerinde yeniden: hygiene + tsc ✅ · unit 1256/1256 ✅ · jest 100 suite / 588 test ✅ · deno check coach-chat ✅ · expo export iOS ✅ (3302 modül) · Android ✅ (3206 modül).
9. HIG (kod denetimi): yeni "Koç'la kişiselleştir" düğmesi `PpButton` (minHeight 52, role button, a11yHint, disabled durumu), sonuç mesajı `accessibilityLiveRegion="polite"`; sepet "Sıradaki" eylemi `toastPill` (minHeight 44, role button). Yeni görsel karar yok.
10. Push: `night36/kararlar`, `release/1.1.0`.

## Commit tablosu
| Commit | Madde | Açıklama |
|---|---|---|
| cbfaa2c | md.4 | Geçmiş güne Logla: tüketim zamanı = o günün tarihi + öğün yuvası saati (kişisel plan saatleri; yoksa 08:00 / 13:00 / 16:00 / 19:30, İstanbul UTC+3); bugün için "şimdi" + birim (5) + bileşen (3) |
| dc4b02d | md.5 | eatkcal sepeti: gramaj/zorunlu seçenek isteyen öğün atlanmaz → ürün sayfası açılır (seçim sonrası sepete orada), diğerleri doğrudan eklenir; özet bildirimi (eklendi, seçim gerekli, satışta değil) + "Sıradaki"; seçenek grupları öğrenilemezse ürün sayfası (güvenli) + testler |
| 71dad46 | md.8 | Kişisel plan sağlık rızası ayrı kaynak `personal_plan` (migration DOSYASI + rollback NOT VALID); geçerli sağlık rızası varsa Giriş'te "Onaylandı", yeni satır yok; yan kuyruk CHECK reddinde satır satır yazar + testler (6) |
| 7732327 | md.11 | Kas kazan fazlası üst sınırı +300 kcal/gün (0,25 → +275, 0,5 → +300 kırpılır); etkin tempo + hedef tarihi kırpılmış fazladan; check-in önerisi de sınırı aşmaz; "Nasıl hesapladık?" tek satır kırpma notu; `PLAN_ALGO_VERSION` 2 + testler |
| 8f7ffd4 | md.12 | Balance akış sonu önizlemesi koç mesajı harcamaz: şablonla ("Şablonla hazırlandı"), altında "Koç'la kişiselleştir" (1 koç mesajı, mevcut meal-plan-generate); Koç yok / kota bitti → şablon + etiket + uyarı; TR/EN + testler (4) |
| 37661bb | md.13 | coach-chat sistem istemi kişisel planı okur (hedef, kalori/makro, tempo, hedef tarihi) — yalnız Koç AI izni açıksa (son `user_consents` ai_coach satırı; yoksa istemcinin `ai_consent` bildirimi); G34 kolonları ayrı sorguda (yoksa ana profil bozulmaz); deno check ✅ + birim (6) |
| 26938d7 | md.14 | Bildirim derin bağlantıları: haftalık tartı → `kcal://plan/checkin`, öğün hatırlatması → `kcal://plan/today` (bayrak kapalıysa Kişisel planım); `planLinks.ts` + `linking.ts` + dinleyici `data.url` + testler (5 + 5) |
| d672d53 | kural | Nokta ayracı yok: sepet özeti ve `calc_delta_sub_cap` (TR/EN) virgülle + test |
| 8652196 | md.8 | Migration `20261112120100` → `20261112130100` (G35 çakışması), `git mv` migration + rollback, referanslar güncel |
| 751b0f7 | merge | `merge --no-ff night36/kararlar` → `release/1.1.0` (çakışma yok) |

## KARAR
- Migration numarası: G35 `20261112120100_g35_option_images` zaten `release/1.1.0`'da → G36 `20261112130100`'e kaydırıldı (sıra: G35'ten sonra). İçerik değişmedi.
- md.8 rollback'i `NOT VALID` ile kurar: geri almada var olan `personal_plan` satırları silinmez (rıza geçmişi değişmez), yalnız yeni satırlar denetlenir.
- md.13: plan bağlamı yalnız Koç AI izni açıksa isteme girer; izin satırı yoksa istemcinin gönderdiği `ai_consent` kullanılır; G34 kolonları yoksa (migration uygulanmamış) plan bölümü sessizce atlanır.

## CANLIYA UYGULANACAK (migration — İlter onayıyla, `supabase db push`)
Canlıda son uygulanan: `20261110154258 g22_s2_search` (12 Kas salt-okuma `list_migrations`). Bekleyen dosyalar sırayla:
`20261111100100_g24_coach` → `20261111200100_g25_flags` → `20261111230100_g27_health_consent` → `20261111233100_g29_sticker_path` → `20261112000100_g31_coach_retention_cron` → `20261112100100_g33_meal_plan` → `20261112100200_g33_recipe_seed` → `20261112110100_g34_personal_plan` → `20261112120100_g35_option_images` → **`20261112130100_g36_personal_plan_consent`**.
- G36 önkoşulu: g27 (sağlık rızası) ve g33 (`meal_plan` kaynağı) — CHECK listesi bunları içerir. Yalnız `user_consents.source` CHECK'i genişler (`personal_plan` eklenir); `kind` listesi ve `my_consent_status()` değişmez. İdempotent.
- Rollback: `supabase/rollbacks/20261112130100_g36_personal_plan_consent_rollback.sql`.
- Migration uygulanmadan önce de istemci güvenli: `personal_plan` satırı yan kuyrukta bekler, diğer satırları tıkamaz.

## DEPLOY GEREKİR
- **coach-chat** (md.13): `supabase functions deploy coach-chat --project-ref xtjakvinklthlvsfcncu` (İlter). Migration sırasından bağımsız: G34 kolonları yoksa plan bölümü atlanır, mevcut davranış bozulmaz.
- Mobil: JS/TS → OTA (`release/1.1.0` kanalına İlter karar verir; production OTA onaysız yasak).

## SORULAR
1. CLAUDE.md "backend commit'leri main'e de cherry-pick edilir" diyor; gece kuralı main'e commit'i yasaklıyor. G36 backend commit'leri (71dad46 + 8652196 migration, 37661bb coach-chat) main'e cherry-pick edilsin mi? (Yapılmadı.)
2. coach-chat deploy'u migration'lardan önce mi sonra mı? Öneri: G34 migration'ından sonra (plan bağlamı ancak o zaman dolu gelir); önce deploy edilirse zararsız.
3. md.11 `PLAN_ALGO_VERSION` 2 oldu: eski (v1) kas kazan planları +300'ü aşıyorsa yeniden hesaplama istemi gösterilsin mi, yoksa yalnız yeni/yenilenen planlar mı? (Şimdilik yalnız yeni hesaplamalar sınırlı.)
