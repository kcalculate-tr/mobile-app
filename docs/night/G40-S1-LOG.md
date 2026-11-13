# G40-S1 — Tek marka yeşili #B9EF14 (13 Kas)

Dal `release/1.1.0` · worktree `.claude/worktrees/g23-s1` · yalnız JS/TS (OTA uyumlu) · yeni paket yok · deploy / OTA / canlı DB yazma yok (canlı DB sorgulanmadı; vitrin yalnız herkese açık menüyü GET ile okudu).

## ÖZET
1. **md.1 Tek kaynak**:
   - `tokens.ts › palette.lime` artık `#B9EF14`.
   - `brandLime` anahtarı silindi. Kullanımları (koç kartı + testi) `palette.lime`'a taşındı.
   - `constants/theme.ts › COLORS.brand.green / greenBright` değeri `palette.lime`'dan okuyor (hex kopyası yok, döngüsel import yok: tokens hiçbir şey import etmiyor).
2. **md.2 Sabit hex'ler**:
   - `src`'de eski lime hex'i geçen 75 satır temizlendi.
   - 39 dosyada (4 eski kabuk dosyası hariç) `'#…'` / `="#…"` → `palette.lime`. Yerel `LIME` sabitleri de token'dan okuyor.
   - SVG `<Stop stopColor>` dahil JSX'te token kullanıldı. Yalnız PDF HTML string'i (`exportNutritionReport.ts`) ve yorumlar `#B9EF14` yazıyor.
   - `rgba(198,240,79,a)` → `rgba(185,239,20,a)`: 8 satırda, alfa ve boşluk biçimi aynı.
3. **md.3 Dokunulmayanlar**: `limeLineOnLight` #4A6B00, makro renkleri, `greenTicker` #BAF112, cam PNG'ler, eski kabuk (aşağıdaki "Hariç tutulanlar").
4. **md.4 Okunurluk**:
   - Lime dolgu üstündeki metin ve ikonlar her temada siyah (`#0A0A0A` / `onAccent` = `limeInk`). Taranan yerler: CartBar, Tara "Logla", koç balonu, ses mikrofonu, bekleme listesi onay ikonu, paywall CTA ve deneme çipi, SubResult.
   - **Açık zeminde lime METİN bulundu, düzeltildi**: `src/modules/profil/ui/screens/SignupEatScreen.tsx:95` şehir listesindeki "aktif" notu ve `:106` seçili onay ikonu.
     - Önce `t.color.accent` (açık temada saf lime, beyaz zeminde 1,36:1).
     - Şimdi `t.color.accentLine` (açık #4A6B00 → 6,19:1; koyu lime aynı).
5. **md.5 Koruma testi**: `src/dev/__tests__/singleBrandLime.test.ts` (unit, 4 test). Denetledikleri:
   - `palette.lime === '#B9EF14'`, `brandLime` yok, `limeInk` ve `limeLineOnLight` sabit.
   - `COLORS.brand.green === palette.lime`, theme.ts'te hex kopyası yok.
   - `src` altında eski hex (büyük/küçük harf, 8 haneli alfa ekli, `0x`) ve `198, 240, 79` (boşluklu/boşluksuz) yok. Taranan uzantılar: ts/tsx/js/json/snap/html/svg/css.
   - Eski kabuk 4 dosyası tam eşleşme SAYISIYLA izinli: sayı artarsa ya da dosya silinirse test kırılır.
6. **md.6 Kontroller** (son hâl):

   | Kontrol | Sonuç |
   |---|---|
   | hygiene + tsc | ✓ |
   | unit | 1280/1280 ✓ (yeni 4) |
   | jest | 106 suite / 638 test ✓ |
   | `expo export` iOS / Android | ✓ / ✓ (2 kez: md.1–5 sonrası ve son hâl) |
   | Paket taraması (Hermes) | eski hex 0. Eski rgba yalnız eski kabuk dosyalarından (iOS 3 / Android 2 dize) |
   | Simülatör piksel ölçümü | Koç kartı, paywall (Dark), ürün seçili kartı, Tara "Logla": baskın lime pikseli tam **#B9EF14** |

## Commit'ler
| Commit | Konu |
|---|---|
| 73756df | md.1–5: palette.lime tek kaynak, eski lime → token/yeni rgba, SignupEat accentLine, koruma testi (45 dosya) |
| 771c09a | vitrin `G40-EkProductOpt` (seçim grubu olan ilk ürün, zorunlu gruplar dolu — yalnız __DEV__) + ekran görüntüleri `docs/night/g40/` |
| (bu) | docs: G40-S1 LOG |
| (son) | docs/night/G40-S1-DONE |

**Değişen dosya sayısı**: md.1–5'te 45 `src` dosyası. Dağılım: 41 kaynak + 3 test güncellemesi + 1 yeni test. Vitrin commit'inde 3 dosya (`dev/screenCatalog.ts`, `dev/vitrinSetup.ts`, `EkProductScreen.tsx`'te yalnız `__DEV__` vitrin etkisi) + 12 JPEG.

## Hariç tutulanlar
- **Eski kabuk (bayrak kapalı, 1.0.7 bayt bayt)**: aşağıdaki 5 `rgba(198,240,79,…)` satırı aynen kaldı. Bu ekranların geri kalanı zaten `COLORS.brand.green` kullanıyor (o da artık token'dan #B9EF14).
  - `modules/eatkcal/screens/CheckoutScreen.tsx:3476, 3485`: eski ödeme. `checkoutScreenFor` → `yeni_siparis` kapalı ya da sağlayıcı paynkolay değilse.
  - `components/PrivilegedBadge.tsx:27`: yalnız eski CheckoutScreen kullanıyor.
  - `components/modals/MacroPointModal.tsx:29`: yalnız eski ProfileScreen / MacroScreen kullanıyor.
  - `screens/profile/SupportScreen.tsx:450`: `ProfileSupport` → `v2ScreenFor(…, yeniSiparis, …)` bayrak kapalı yolu.
- `limeLineOnLight` #4A6B00 ve açık temada kullanılan diğer koyu lime çizgileri (#5E7A12 kilo grafiği, personalPlan) aynı kaldı.
- Makro renkleri, `greenTicker` #BAF112, `assets/glass/*.png` aynı kaldı.
- `src` dışındaki dosyalara (app.config, native, assets) dokunulmadı. Eski lime orada da geçmiyor (tarandı).

## KARAR
1. `brandLime` takma ad olarak bırakılmadı, tamamen silindi. Tek kullanıcısı koç kartıydı, `palette.lime`'a taşındı. Test, anahtarın geri gelmesini engelliyor.
2. Yön: `constants/theme.ts` → `tokens.ts` (eski dosya yeni token'ı okuyor). `noLegacyWhenFlagsOn` kuralı (yeni yol eski `COLORS`'u import etmesin) bu yönde bozulmuyor.
3. Eski kabuk dosyalarındaki eski rgba, bayt bayt kuralı nedeniyle bırakıldı. Testte sayılı istisna olarak kayıtlı (G-TEMİZLİK'te liste boşalır).
4. Ürün sayfası çekimi için mevcut `FinEkProductSelected` yetmedi: canlı menünün ilk ürünü seçeneksiz bir sos (görüntüde seçili seçenek yok). Bunun için yalnız `__DEV__` eklemeler yapıldı:
   - `__withOptions__` yer tutucusu: birden çok seçenekli grubu olan ilk ürünü GET okumayla bulur.
   - Vitrinde zorunlu gruplar ilk seçeneklerle doldurulur.
   - Üretimde `vitrinState` her zaman undefined.
5. Ana sayfa için iki görüntü alındı: `Home` (Final ana sayfa, öğün yuvaları + "Akşam'a logla") ve `HomeCoach` (koç kartı dolgusu).

## HIG (kod denetimi — renk değişikliği)
- **Kontrast** (WCAG):
  - siyah / #B9EF14 14,5:1 (eski lime 15,1:1; fark önemsiz)
  - #B9EF14 / siyah 15,4:1 · #B9EF14 / koyu yüzey #1C1C1E 12,5:1
  - #4A6B00 / beyaz 6,2:1 · #4A6B00 / açık zemin #F3F4F6 5,6:1 ✓ AA
- **Açık zeminde lime metin**: 1 yer bulundu, düzeltildi (yukarıda md.4).
- **Dokunma alanı, VoiceOver, Dynamic Type, hareket**: değişmedi (yalnız renk değeri değişti).

## Ekran görüntüleri (`docs/night/g40/`, Light + Dark, 12 JPEG)
| Dosya | Sahne (vitrin) | Lime görünen yer |
|---|---|---|
| `Home-*` | `FinHomeR3` | "Akşam'a logla" düğmesi, halkalar |
| `HomeCoach-*` | `G39-HomeCoach` | koç kartı dolgusu, Keşfet halkaları |
| `ScanResult-*` | `FinPhotoR1` | Tara sonucu "Öğle'ye logla" düğmesi + "Gör" |
| `PaywallFresh-*` | `G39-PaywallFresh` | seçili plan çerçevesi, radyo, deneme çipi, CTA, ışıma |
| `Kesfet-*` | `G39-Kesfet` | "Öğle'ye logla", hikâye halkaları |
| `EkProduct-*` | `G40-EkProductOpt` | seçili seçenek kartı (#B9EF14), kcal halkası (açıkta #4A6B00), etkin "Sepete ekle" |

Nasıl alındı:
- Yeni **"G40 iPhone"** simülatörü (`D2B68EDD-D6A9-4059-98B8-232F5CF8A804`, iPhone 17 / iOS 26.5) oluşturuldu.
- Üzerine 9 Kas tarihli 1.1.0 dev build kuruldu. Metro bu worktree'den çalıştı (port 8140), çekimler `scripts/dev/g14-shots.sh` ile alındı.
- Diskte 17 GB boş vardı (kural ≥ 20 GB), native derleme yapılmadı. İlter'in "iPhone 17" simülatörüne dokunulmadı.

## CANLIYA UYGULANACAK
Yok (migration / DB değişikliği yok).

## DEPLOY GEREKİR
- OTA: yalnız JS, native değişiklik yok. Production OTA onaysız yasak, İlter yayınlar:
  `eas update --branch production --environment production --message "G40-S1 tek marka yesili #B9EF14"`

## SORULAR
1. **Lime yükleniyor göstergeleri açık zeminde**: `SettingsPrivacyScreen.tsx:181` ve `SettingsSupportScreen.tsx:388` (`ActivityIndicator color={t.color.accent}`).
   - Metin değil, ama beyaz zeminde 1,36:1 (WCAG 1.4.11 metin dışı öğe için 3:1 ister).
   - Madde "yalnız metin" dediği için değiştirilmedi. `accentLine`'a çevrilsin mi?
2. **Yeni tasarım dışında kalan sabit `'#B9EF14'` yazımları**: değer zaten doğru, ama token'a bağlı değil.
   - Liste: `core/ui/Toast.tsx`, `core/notifications.ts` (Android bildirim ışığı), `components/share/DeepLinkLanding.tsx`, `MealShareCard`, `PlateXRayShareModal`, `ReviewReportSheet`, `DeliveryInfoModal`, `lib/campaignVisual.ts`, `theme/sportive.ts`.
   - Bunların dışındakiler eski kabuk.
   - Kapsam yalnız eski hex olduğu için dokunulmadı. Hepsi `palette.lime`'a bağlansın mı?
3. Simülatör "G40 iPhone" açık bırakıldı. Silmek için `xcrun simctl delete D2B68EDD-D6A9-4059-98B8-232F5CF8A804`.
4. CLAUDE.md'deki backend cherry-pick kuralı: bu oturumda `supabase/` değişikliği yok.
