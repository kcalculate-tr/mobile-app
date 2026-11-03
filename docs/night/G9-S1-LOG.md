# G9-S1-LOG — Dondurma adayı: G8 birleşimi, 3a–3j düzeltmeleri, sürüm 1.1.0

## 10 satır özet
1. Dal `night9/release` (taban `night7/release`), worktree `.claude/worktrees/g9-s1`. 5 Kasım mağaza derlemesi bu daldan.
2. Üç G8 dalı sırayla birleşti: `night8/social-backend` (ff), `night8/social-ui`, `night8/video`. Çakışma yalnız `types.ts` + `KesfetScreen.tsx`'te; iki taraf da korundu (video+yorum+bildirim prop'ları birlikte).
3. Sürüm `app.config.js`: 1.0.7 → **1.1.0**, Android `versionCode` 9 → 10 (başka sürüm sabiti yok; `package.json` zaten 1.0.0 — kullanılmıyor).
4. Tüm backend düzeltmeleri tek migration: `supabase/migrations/20261105000100_g9_fixes.sql` (+ rollback + `supabase/tests/g9_fixes_test.sql`). G6-APPLY'a **#14** eklendi (EN SON uygulanır).
5. 3a istemci: gönderi fotoğrafı `post-media`/`posts/{uid}/...` (eskiden özel `user-media`). 3d istemci: handle 3–30. 3i istemci: MET `fitness` 6.0 (sunucu=kaynak).
6. 3b: `user-media` SELECT'e day_share + `feed_can_view_author`/moderatör EK politikası; `get_day_cards` erişimi `feed_can_view_author`'a geçti (engel+takip+gizlilik tek yerde).
7. 3c: `posts` BEFORE UPDATE guard — yazar `status`/`pinned_until`/`author_id` değiştiremez (yalnız mod/servis/RPC; `app.post_rpc`). moderate-content edge fn (service_role) ve cron (rolsüz) serbest → yayın akışı bozulmaz.
8. 3e: `admin_create_post` panel `carb_g`'yi `carbs_g`'ye çevirir. 3f: `mod_resolve_report(dismiss)` pending → published. 3g: `add_comment` `kesfet_yorum` kapalıyken reddeder. 3h: `get_user_day_progress` içine `feed_can_view_author` kapısı + revoke. 3j: content_reports/moderation_actions comment+ai CHECK idempotent teyit (G8-S1'de yapılmıştı).
9. Kontroller: `tsc` 0, `test:unit` 404/404, `test:components` 30/30 (jest), `expo prebuild -p ios --no-install` ✓, `expo export --platform ios` ✓ (8.33 MB hbc).
10. Bayrak-kapalı güvenliği yeniden doğrulandı: tüm G8 giriş noktaları bayrak arkasında; tüm bayraklar `false`; prod'da `__DEV__=false` → davranış 1.0.7 ile birebir aynı. **SORULAR yok.**

## Birleştirme çakışma çözümü
- `src/modules/kesfet/types.ts` (FeedMedia video alanları): HEAD'in `MediaKind` + nullable sürümü tutuldu (video tarafının `'image'|'video'` tanımının üst kümesi).
- `src/modules/kesfet/ui/KesfetScreen.tsx`:
  - import: `useNavigation` (social-ui) + `expo-clipboard` (video) ikisi de korundu.
  - `renderItem` PostCard prop'ları: `showComment={kesfetYorum}` (yorum) + `isVisible={item.id===visiblePostId}` (video oynatma) birlikte; `onLike` zengin sürümü (`touchSocial()`).
  - `useCallback` bağımlılıkları birleşik küme: `[nowMs, lang, onShare, kesfetYorum, touchSocial, onDidIt, visiblePostId]`.
- `src/core/flags/registry.ts`: merge sonrası **mükerrer** `kesfet_video` anahtarı temizlendi (tek satır kaldı).

## Düzeltme → test eşlemesi
| # | Düzeltme | Yer | Test |
|---|----------|-----|------|
| 3a | Gönderi medyası `post-media`/`posts/{uid}/` | `media.ts`, `mediaPath.ts` + migration storage politikaları | `kesfet/__tests__/g9.test.ts` (kova/yol) |
| 3b | Gün kartı fotoğrafı takipçiye açık | migration (user-media EK politika + `get_day_cards`) | `g9_fixes_test.sql` 3b (C görür / B görmez) |
| 3c | Gönderi durumu korumalı | migration (posts guard + delete_my_post) | `g9_fixes_test.sql` 3c (yazar status X / body ✓ / delete ✓) |
| 3d | Handle Instagram kuralı 3–30 nokta | `handle.ts` + migration (CHECK/claim/check) | `handle.g9.test.ts`, `profil.test.ts`, `g9_fixes_test.sql` 3d (ortak vektör) |
| 3e | `carbs_g` tek ad | `admin_create_post` + istemci tipleri (zaten carbs_g) | `g9.test.ts` (carbs_g), `g9_fixes_test.sql` 3e (carb_g→carbs_g) |
| 3f | dismiss → published | `mod_resolve_report` | `g9_fixes_test.sql` 3f (gönderi+yorum) |
| 3g | Yorum bayrak kapısı | `add_comment` | `g9_fixes_test.sql` 3g (kapalı red / açık pending) |
| 3h | Yetki sızıntısı kapatıldı | `get_user_day_progress` + revoke | `g9_fixes_test.sql` 3h (B red / self+takipçi ✓) |
| 3i | MET istemci=sunucu | `activity.ts` (fitness 6.0) | `g9.test.ts` (tüm MET paritesi) |
| 3j | CHECK comment+ai | migration (idempotent teyit) | `g9_fixes_test.sql` 3j |

## Kontrol listesi (bayrak KAPALI = 1.0.7)
- `kesfet`/`kesfet_paylasim` kapalı → Keşfet sekmesi + Composer `AppNavigator`'da kayıtlı değil (prod; `|| __DEV__`).
- `kesfet_yorum` kapalı → PostCard yorum butonu yok **ve** `add_comment` sunucuda reddeder (çift kilit).
- `kesfet_video` kapalı → `MediaGrid` videoyu `FeedVideo` ile çizmez (düz kapak görseli).
- `sosyal_bildirim` kapalı → zil gizli, `NotificationsSheet` yok, `touchSocial()` no-op, `refreshUnread` çağrılmaz.
- `etkinlik` kapalı → `TrackerScreen`'de `TrackerActivityEntry` render olmaz.
- `gun_halkasi`/`ai_tarama`/`paylasim_karti` kapalı → G5/G6/G7 ekranları kapalı (değişmedi).
- 3a storage politikası: bayrak kapalıyken yalnız `feed_can_post` (creator) yazabilir — eskisiyle aynı.
- 3c posts guard: yalnız UPDATE korumalı kolonları etkiler; yeni gönderi (INSERT) ve moderasyon yayını (service_role) etkilenmez.

## Doğrulama komutları (bu oturumda koşuldu, hepsi ✓)
```
npx tsc --noEmit                         # 0 hata
npm run test:unit                        # 404 pass / 0 fail (tsx --test)
npm run test:components                  # 4 suite, 30 test (jest)
npx expo prebuild -p ios --no-install    # Finished prebuild (commit'lenmedi; ios/ gitignore)
npx expo export --platform ios           # Exported: dist (index-*.hbc 8.33 MB)
```

## Commit'ler (night9/release, night7/release sonrası G9 katkısı)
- `d1de899` chore(surum): 1.0.7 → 1.1.0, versionCode 9 → 10
- `673d0e4` merge night8/social-ui · `6f2063a` merge night8/video (çakışma çözümü dahil)
- `b33ec4d` fix(g9-backend): 20261105000100_g9_fixes + rollback + staging testi
- `6d3c99d` fix(g9-istemci): post-media, handle 3-30, MET 6.0, testler
- (bu dosya + G6-APPLY #14) docs commit'i aşağıda.

---

## İlter'in yapacakları

### A. Mağaza derlemesi (5 Kasım akşamı, bu daldan)
`night9/release` sürüm 1.1.0 / versionCode 10. Günlük simülatör komutları değil,
mağaza için **EAS build** (CLAUDE.md "ONAYSIZ YASAK" → build/submit senin onayınla):
```
cd ~/dev/kcal-mobile          # ana checkout'u night9/release'e al (ya da bu worktree'den)
git checkout night9/release && npm ci
# iOS (TestFlight/App Store):
eas build --platform ios --profile production
# Android (Play):
eas build --platform android --profile production
```
Not: yeni yerel paketler (expo-video / expo-video-thumbnails / expo-clipboard) geldiği
için **OTA yetmez, yeni binary şart** — `runtimeVersion` policy `appVersion` olduğundan
1.1.0 kanalı 1.0.7 cihazlardan ayrı; eski cihazlar bu paketi OTA ile ALMAZ (emniyet kilidi).

### B. Mağaza gönderimi (binary yeşil olunca, senin onayınla)
```
eas submit --platform ios --latest
eas submit --platform android --latest
```
App Store'da "Sign in with Apple" + kamera/mikrofon/foto izin metinleri zaten
`app.config.js`'te; gizlilik manifesti prebuild ile üretiliyor.

### C. Canlıya DB uygulama sırası (Dashboard SQL / psql — `supabase db push` KULLANMA)
`docs/night/G6-APPLY.md` sırasını izle: **#0 → #14**, her dosyayı tek tek, elle,
uyguladığını kendin takip et. Yeni dosya bu oturumda eklendi:
- **#14** `supabase/migrations/20261105000100_g9_fixes.sql` — **EN SON** (tüm #1–#13 sonrası).
  - Önkoşul: #12 (`posts.status`+='pending', `content_reports.source`, `moderation_queue`),
    #11 (`profiles_handle_format_chk`) uygulanmış olmalı.
  - İçindeki storage politikaları `post-media`/`user-media` kovalarını (#4/#7) gerektirir.
- Geri alma gerekirse: `supabase/rollbacks/20261105000100_g9_fixes_rollback.sql` (elle;
  istemci değişikliklerini ayrıca git ile geri al).

### D. Edge function (ayrı deploy — bu oturumda deploy EDİLMEDİ)
`moderate-content` ve `analyze-ai-scan` G6-APPLY'daki gibi `supabase functions deploy`
ile; secret'lar (`ANTHROPIC_API_KEY`, `AI_MODERATION_MODEL`/`AI_SCAN_MODEL` geçerli
modele) `supabase secrets set` ile. #13 cron'u yalnız `moderate-content` deploy +
Vault `service_role_key` sonrası anlamlı.

### E. Uygulama sonrası staging testleri
- `supabase/tests/feed_rls_test.sql` (G5–G8 senaryoları) + `supabase/tests/g9_fixes_test.sql`
  (3b–3j) staging'de `psql -f` ile koş; ikisi de `BEGIN…ROLLBACK`, kalıcı veri bırakmaz.
  NOT: ikisi de bu gece staging'de KOŞULMADI (yalnız dosya) — canlıya uygulamadan önce staging'de doğrula.

### F. Bayraklar
Hepsi `false`; açmak senin dalga planı kararın. Kapalıyken uygulama 1.0.7 ile aynı.
`kesfet_video` için yeni binary (1.1.0) şart; diğerleri yalnızca sunucu + bayrak.
