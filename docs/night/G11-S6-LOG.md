# G11-S6 — Entegrasyon: G11'i birleştir, bağla, doğrula → dondurma adayı (opus)

## Özet (10 satır)
1. Dal `night11/release` (taban `night10/release`), worktree `.claude/worktrees/g11-s6`. Dört dal SIRAYLA birleştirildi: `server` (fast-forward) → `shell` → `kesfet` → `gun-profil`. Her merge sonrası `tsc --noEmit` = 0.
2. Çakışma ÇIKMADI. `dictionaries.ts` üç kez değişti ama farklı ad alanları (shell/kesfet/share_card/gun/meal/profil/ai_scan/eatkcal) olduğundan `ort` otomatik birleştirdi; tr+en blokları simetrik, hiçbir anahtar kaybı yok, `common` bloğu bire bir aynı.
3. **Bağlantı (m.3):** Keşfet (`KesfetScreen` `Animated.FlatList`) ve Tracker (`TrackerScreen` `Reanimated.ScrollView`) listelerine `useTabBarCollapse(scrollY)` bağlandı; asTab alt boşluğu geçici `96` yerine tek kaynak `src/modules/shell` → `TAB_BAR_R3_HEIGHT` (=96, değer aynı).
4. **Bağlantı (m.3):** `search_products` kolon eşlemesi → `docs/night/G11-CONTRACT-EK.md` (gerçek `.claude/night/G11-CONTRACT.md` gitignored + izole worktree dışı → tracked ek dosyaya taşındı). S3/S4'te **ikisinde de bulunan** yerel hareket hook'u YOK (`gun/motion.ts` yalnız saf yardımcı) → `motion.tsx`'e taşınacak bir şey çıkmadı.
5. **jest.setup (ENTEGRASYONA S3 #3):** `@react-native-google-signin/google-signin` + `expo-video` taklitleri eklendi; `PostCard.test.tsx` yerel `MediaGrid` mock'u kaldırıldı.
6. **EK DÜZELTME (migration §4):** `20261105000300_g11_fixes.sql` iki `moderation_queue` insert'i (`guard` gövde dalı + `update_my_post`) `on conflict do nothing` → `on conflict (target_type,target_id) do update set status='pending', attempts=0, last_attempt_at=null`. Önceden denetlenmiş (kuyruk `done`) gönderi düzenlenince kuyruk açılmıyordu → gönderi sonsuza dek `pending` kalıyordu. `feed_rls_test.sql` T29d senaryosu eklendi. Migration YALNIZ dosya (canlıya uygulanmadı).
7. **Bayrak kapalı = 1.0.7 kanıtı (m.4):** `git diff night10/release HEAD` — HomeScreen + Cart/Checkout/Payment/OrderSuccess + `paynkolay*`/`payment*`/`cart*`/`orders*` + `store/cartStore` + `screens/auth/**` dosyalarında **BOŞ**. `common` i18n bloğu bire bir aynı. `registry.yeni_kabuk=false`; AppNavigator soğuk-başlangıçta false iken bugünkü `TabNavigator`. TabBarR3 "Eski kabuk parite (bayrak kapalı)" testi geçiyor.
8. **Bayrak açık duman (m.5):** yeni kabuk bileşenleri (TabBarR3, TrackerDayHeader, ProfileSocialHeader, ComposerSearch, PostCard, PostMenu, states) jest'te hatasız render; `expo export` bayrak-açık kod yollarını paketliyor. Kırmızı hata yok (act() uyarıları zararsız, hata değil). Canlı simülatör duman testi İlter'de (aşağıda).
9. **Sürüm (m.6):** `app.config.js` DOKUNULMADI — `version '1.1.0'`, `versionCode 10` (iOS buildNumber '1'). `package.json` da değişmedi.
10. **Kontrol (m.7):** `tsc` 0 · `test:unit` **429/429** · `test:components` **12 süit / 56 test** · `expo prebuild -p ios --no-install` ✓ (commit'lenmedi, `ios/` gitignored) · `expo export --platform ios` ✓ (8.42 MB bundle). Son commit `docs/night/G11-S6-DONE`.

## Birleştirme sırası ve tsc
| # | Dal | Yöntem | Çakışma | tsc |
|---|-----|--------|---------|-----|
| 1 | `night11/server` | fast-forward | — | 0 |
| 2 | `night11/shell` | ort merge | yok | 0 |
| 3 | `night11/kesfet` | ort merge | yok (dictionaries auto) | 0 |
| 4 | `night11/gun-profil` | ort merge | yok (dictionaries auto) | 0 |

## ENTEGRASYONA notları — ne yapıldı
- **S1:** Yok (ENTEGRASYONA boştu). Sunucu bayrak satırı S1 migration'ında zaten.
- **S2:** (a) Keşfet+Tracker → `useTabBarCollapse` bağlandı. (b) Alt boşluk `TAB_BAR_R3_HEIGHT`'a bağlandı. (c) Açılış sekmesi (Tracker-ilk) — kalıcı sipariş-geçmişi store'u YOK; `hasOrderHistory` sinyali eklenmedi, S2'nin güvenli varsayılanı (`Home`) korundu → G12'YE.
- **S3:** (1) `TAB_BAR_R3_HEIGHT` bağlandı. (2) collapse bağlandı. (3) jest.setup taklitleri eklendi + yerel mock kaldırıldı. (4) RPC'ler (S1) otomatik — ek istemci değişikliği yok.
- **S4:** (1) `registry.yeni_kabuk` S2'de zaten. (2) `TAB_BAR_R3_HEIGHT` bağlandı. (3) collapse bağlandı. (4) `PublicProfile.blocked` sunucu kararı — şimdilik dönmüyor, güvenli. (5) AI tarama `source` — mevcut davranış korundu → G12/Dalga.

## Bayrak kapalı = 1.0.7 kanıtı (komut + sonuç)
```
git diff --stat night10/release HEAD -- \
  src/screens/HomeScreen.tsx \
  src/modules/eatkcal/screens/{Cart,Checkout,Payment,OrderSuccess}Screen.tsx \
  'src/lib/paynkolay*' src/lib/{payment,paymentDrop,paymentHtml,checkoutPayment,cart,cartSignature,orders,activeOrder,reorder}.ts \
  src/store/cartStore.ts 'src/components/checkout/**' src/config/payment.ts \
  src/screens/profile/{OrderDetail,Orders}Screen.tsx 'src/screens/auth/**'
→ BOŞ (hiçbir satır)
# common i18n bloğu (tr+en): night10 ↔ HEAD diff BOŞ
# registry.yeni_kabuk=false; TabBarR3 "Eski kabuk parite" testi PASS
```
Not: `EatHomeScreen.tsx` (S4, `restoran_yakinda` arkasında) değişti ama bu KİMSE değil S4 dosyası; sipariş/ödeme akışına dokunmaz.

## G12'YE (SON_HAL'e aykırılık değil, sonraki tur işi)
- Açılış sekmesi "Tracker-ilk" kuralı için kalıcı sipariş-geçmişi sinyali gerek (`TabNavigatorR3.hasOrderHistory`). Şu an oturumlu kullanıcı `Home` açıyor (güvenli).
- `search_products` canlı `products` kolon adları doğrulanmalı (bkz. CANLI-SIRA).

## İlter'in yapacakları
### (a) Simülatörde deneme adımları
1. Native derleme + kurulum (CLAUDE.md "Yerel iOS geliştirme" 1. komut — kendi UDID'in ile).
2. `export PATH="/opt/homebrew/opt/node@20/bin:$PATH"; cd ~/dev/kcal-mobile && npx expo start --dev-client` (bu worktree değil, ana geliştirme döngün; ya da worktree'de dev-client).
3. Uygulama açılınca **bugünkü hâliyle bire bir** olmalı (tüm bayraklar kapalı = 1.0.7).
4. **Tasarım vitrini** → "Bayraklar ve geliştirici ekranları →" çipi → **Tanı** ekranı.
5. **Tanı** → "🚀 Yeni uygulamayı aç" ön ayarı (yeni kabuk + Keşfet + Tara + gün halkası + sosyal bayrakları açar) → uygulamayı yeniden aç (soğuk başlangıç).
6. Mock modunda sırayla dene: 4 sekme (Ana sayfa/Keşfet/eatkcal/Profil), Tara düğmesi, composer + "Ürün ara", yorum, bildirim, profil sosyal başlık, gün halkası; kaydırınca tab barın küçülmesi; konsolda kırmızı hata olmamalı.

### (b) 5 Kasım derleme/gönderim komutları — BU DALDAN (`night11/release`)
> ONAY GEREKİR (CLAUDE.md "ONAYSIZ YASAK"): production build / mağaza gönderimi senin elinle.
```
cd ~/dev/kcal-mobile/.claude/worktrees/g11-s6   # ya da night11/release'i checkout et
# Gerçek cihaz / mağaza derlemesi:
eas build --platform ios --profile production
eas build --platform android --profile production
# Mağaza gönderimi (onayınla):
eas submit --platform ios --latest
eas submit --platform android --latest
```
Sürüm 1.1.0 / versionCode 10 hazır; `app.config.js` değiştirme (zaten doğru).

### (c) Canlı uygulama / sunucu sırası
Migration'lar + RPC'ler + `search_products` canlı kolon doğrulaması için:
**`docs/night/G11-CANLI-SIRA.md`** (S1) adım adım sırayı veriyor. `search_products` kolon
eşlemesi: **`docs/night/G11-CONTRACT-EK.md`**.

## Kontrol komutları (bu oturumda koşuldu)
```
npx tsc --noEmit                       # 0 (her merge sonrası + final)
npm run test:unit                      # 429 pass / 0 fail
npm run test:components                # 12 süit / 56 test pass
npx expo prebuild -p ios --no-install  # ✓ (commit'lenmedi; ios/ gitignored)
npx expo export --platform ios         # ✓ Exported: dist (8.42 MB)
```

## Commit'ler (S6, night10/release..HEAD üstü)
- `38eb4b5` feat(g11-s6): Keşfet+Tracker TAB_BAR_R3_HEIGHT + useTabBarCollapse
- `99fc573` test(g11-s6): jest.setup google-signin + expo-video mock
- `2a23193` docs(g11-s6): G11-CONTRACT Ek — search_products kolon eşlemesi
- `3c18877` fix(g11-backend): moderation_queue 'done' → düzenlemede 'pending'
- `+ 3 merge` (shell/kesfet/gun-profil) + server fast-forward
- Son: `docs/night/G11-S6-DONE`

İlgili: [G11-CANLI-SIRA.md](./G11-CANLI-SIRA.md), [G11-CONTRACT-EK.md](./G11-CONTRACT-EK.md), [G11-S1-LOG.md](./G11-S1-LOG.md), [G11-S2-LOG.md](./G11-S2-LOG.md), [G11-S3-LOG.md](./G11-S3-LOG.md), [G11-S4-LOG.md](./G11-S4-LOG.md).
