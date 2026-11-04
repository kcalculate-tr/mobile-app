# G12-S3 — Ana sayfa, Gün halkası, kutlamalar, koleksiyon, cam nesneler

Dal `night12/home` (taban `night11/release`). Worktree `.claude/worktrees/g12-s3`.

> **DEVAM NOTU:** Önceki oturum gece kullanım limitine takıldı; tüm iş çalışma
> ağacında commit edilmemiş haldeydi (celebrate/, collection/, gun/ veri katmanı,
> assets/glass, i18n sözlüğü). Bu oturum: korunan iş üzerine `tsc` hatası
> giderildi (LiquidDots `SharedValue` importu), yeşil doğrulama alındı ve 8 madde
> tek commit setinde `night12/home`'a işlendi. Mimari bağlama (TrackerScreen /
> Keşfet / Tara / Profil) sözleşme gereği S4/ENTEGRASYONA'ya bırakıldı — bu
> oturum katmanları + testleri teslim eder, bayrak-kapalı Tracker'a hiç dokunmaz.

## Mimari karar: katman + bileşen, bağlama ertelenir
Bu oturum **saf veri katmanı + sunum bileşenleri** üretir. Yayınlayan/tüketen
taraflar (Keşfet, Tara, eatkcal, TrackerScreen, Profil) ayrı oturumların işidir;
`logFlight` dosyasındaki not ve sözleşme madde 6'daki "Profil satırını S4 bağlar →
ENTEGRASYONA" bunu açıkça söylüyor. Sonuç: **`src/screens/` ve `src/navigation/`
hiç değişmedi** → `yeni_kabuk` bayrağı kapalıyken Tracker baytı baytına aynı
(aşağıda kanıt).

## 8 madde

1. **GlassObject + assets/glass** — `src/modules/celebrate/GlassObject.tsx`
   (core S1'in `src/core/design/components/GlassObject.tsx` YERİNE, sözleşme
   gereği; core sürümü DesignShowcase için yerinde kaldı, dokunulmadı).
   `assets/glass/` 5 PNG: bowl, drop, flame, foot, trophy. FinMoGlass değerleri,
   azaltılmış harekete saygı (`useReducedMotion`). Ekran başına bir örnek.

2. **Ana sayfa veri katmanı (FinHomeR3)** — `src/modules/gun/homeData.ts`:
   `buildSlots` (4 öğün yuvası, boş yuvalar dahil), `normalizeMealType`
   (TR+EN meal_type kanonu), `sourceInfo` (kaynak rozeti: Tara/Keşfet/eatkcal/
   Elle), `energyRing`/`macroRing` durum halkaları, `groupThousands` (TR `1.840`
   / EN `1,840`). Veri yoksa yuva `empty` döner (uydurma yok). i18n anahtarları
   `dictionaries.ts` `home`/`meal` altında (EN + TR), teslim/boş/XL varyant
   metinleri dahil.

3. **İmza anlar** — `src/modules/gun/ui/LiquidDots.tsx` (FinMoLiquid): Skia YOK →
   `react-native-svg` daireleri + Reanimated ile "efektsiz birleşme" (noktalar
   merkeze akıp söner), azaltılmış harekette statik. Logla izi/halka dolumu/seri
   imza anları G11'den gelen `TrackerDayHeader` + motion token'larıyla beslenir;
   bu katman `emitLogFlight`/`onLogFlight` (`logFlight.ts`) olay köprüsünü sağlar.

4. **eatkcal teslim → otomatik log** — `src/modules/gun/delivery.ts`:
   `deliveredAutoLog` mevcut `orders`+`order_items` kaydından (sipariş/ödeme
   dosyalarına DOKUNMADAN) FinHomeDelivered kartını türetir; `isFreshDelivery`
   teslim "taze mi" penceresi. Yeni tablo yok.

5. **Kutlamalar** — `src/modules/celebrate/`: `useCelebrations` +saf `pickCelebration`
   (öncelik first > streak7 > streak3, ömür boyu bir kez, AsyncStorage
   `@kcal_celebrate_shown`), `CelebrateOverlay` (ilk öğün / 3 gün / 7 gün seri +
   rozet), `NotifyPermissionSheet` (FinSheetNotify, mevcut izin akışıyla).

6. **Koleksiyon** — `src/modules/collection/`: `deriveCards` (SAF; yalnız
   photoUri'li tarama/öğün kayıtlarından kart; yeni tablo YOK; katalog no kararlı/
   deterministik), `store.ts` yerel kalıcılık (AsyncStorage `@kcal_collection_v1`,
   **Dalga 2'de sunucuya** notu kodda), `StickerCard`/`CollectionGrid`/
   `CollectionWon`/`ProfileCollectionRow` (Profil satırını **S4 bağlar →
   ENTEGRASYONA**).

7. **Gün görüntüleyici / Bugünkü etkinlikler** — `gun/ui/` (GunViewer, GunEmpty,
   GunRingStrip, viewerQueue) G11-S6'dan son hâliyle duruyor; S3 veri katmanı
   bunları besler.

8. **Testler + kontrol** — aşağıdaki "Doğrulama".

## Doğrulama
- `tsc --noEmit`: **0 hata** (düzeltilen tek hata: LiquidDots `SharedValue`
  `react-native-reanimated`'tan type-import edildi, `Animated.SharedValue` değil).
- `npm run hygiene`: OK (827 takipli dosya, duplicate yok).
- `npm run test:unit` (tsx --test): **441/441 geçti** — celebrate + collection +
  gun/homeData saf testleri dahil.
- `npm run test:components` (jest): **56/56 geçti**, 12 suite (TrackerDayHeader
  dahil; act() uyarıları gürültü, hata değil).
- `npx expo export --platform ios`: **exit 0**, iOS bundle 8.43 MB üretildi.

## Bayrak-kapalı Tracker aynı (kanıt)
- `git diff night11/release -- src/screens/TrackerScreen.tsx` → **boş** (fark yok).
- Yeni modüller `src/screens/`/`src/navigation/` içinde hiç import edilmiyor.
- Tracked değişiklik yalnız additive: `dictionaries.ts` (yeni i18n anahtarları),
  `gun/index.ts` (yeni export'lar) — mevcut davranışı değiştirmez.
- Sonuç: `yeni_kabuk` kapalıyken render yolu değişmez; Tracker baytı baytına aynı.

## Ilter'in yapacakları (ENTEGRASYONA → S4/S6)
- Keşfet/Tara/eatkcal loglama anında `emitLogFlight(...)` çağrısı.
- TrackerScreen yeni kabuk gövdesine FinHomeR3 öğün yuvalarının (`buildSlots`)
  bağlanması + `onLogFlight` vurgusu.
- `CelebrateOverlay`'in gerçek streak/ilk-öğün sinyaline bağlanması.
- Profil ekranına `ProfileCollectionRow` + koleksiyon ızgarası geçişi.
- Koleksiyon "kazanıldı" durumunun Dalga 2'de sunucuya taşınması.
</content>
</invoke>
