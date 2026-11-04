## ÖZET (10 satır)
G12-S2 Keşfet'i Final tasarıma (`design/SON_HAL.md` v2, `Fin*.dc.html`) giydirdi: lime
"⟨Öğün⟩'ye logla ⌄" + `kcal:logFlight`/`logUndo` + toast Geri al/Gör (ae9ed74); bu
oturumda üstüne Topluluk kuralları (FinRules, ilk paylaşımdan önce bir kez), akış
ipucu şeridi (FinFeedTip, bir kez), şikayet sonuç adımları (FinReportDone/Notice,
toast yerine sheet) eklendi; dokunma ≥44 denetimi yapıldı, bir gerçek ihlal
(MealCard logBtn — Final h32 flexbox'ta 44'e şişiyordu) düzeltildi, kalan 8 küçük
düğme/çipe hitSlop eklendi. `Fin*.dc.html` çoğu `dc-import` kabuğu (gerçek metin
yok) — eksik metinler (rules/feed_tip/report_notice) SORULAR'da işaretli, kendi
üslubumuzla yazıldı. tsc 0 · test:unit 429/429 · jest 67/67 · expo export OK.
Commit'ler: ae9ed74, 8f178e5. ENTEGRASYONA yok (yalnız kendi dosyalarımız).

## 1) Pano ↔ bileşen eşleşme tablosu

| Final pano | Bileşen · dosya | Durum |
|---|---|---|
| FinFeed, FinFeedScrollR3 | `KesfetScreen.tsx` (Animated.FlatList, `useTabBarCollapse(scrollY)`, G11-CONTRACT m.39) | Var (G11-S6) |
| FinFeedTip | `FeedTip.tsx` (yeni) — akışa ilk girişte bir kez ipucu şeridi, `ListHeaderComponent`/boş dallara eklendi | Yeni (bu oturum) |
| FinFollowingEmpty | `states.tsx` → `FollowingEmpty` (önerilen hesaplar, gerçek veri) | Var |
| FinDetail | `src/screens/share/SharedPostScreen.tsx` (derin bağlantı `/p/:postId`) | Var (G7-S1, ae9ed74'te güncellendi) |
| FinSerbest | `ComposerScreen.tsx` tür='serbest' + `PostCard.tsx` serbest render | Var |
| FinActivityCard | `ActivityCard.tsx` ("Ben de yaptım", `didItBtn` hitSlop eklendi) | Var + düzeltme |
| FinVideo | `MediaGrid.tsx` → `FeedVideo` (`../../media/video`), `kesfet_video` bayrağı arkasında | Var |
| FinCompose | `ComposerScreen.tsx` | Var + RulesSheet entegrasyonu |
| FinPosting | `ComposerScreen.tsx` `statusBar` (publishing/reviewing) | Var |
| FinRules | `RulesSheet.tsx` (yeni) | Yeni (bu oturum) |
| FinComments | `CommentsSheet.tsx` | Var + sendBtn hitSlop |
| FinNotifications | `NotificationsSheet.tsx` | Var |
| FinAddSheet | `AddToDaySheet.tsx` (porsiyon ½·1·1½·2) | Var |
| FinAddToast | `AddToast.tsx` ("…'ye loglandı · Geri al · Gör") | Var (ae9ed74) |
| FinPostMenu | `PostMenu.tsx` view='menu' | Var |
| FinPostMenuBlock | `PostMenu.tsx` view='block' | Var |
| FinReport | `PostMenu.tsx` view='report' (REPORT_REASONS) | Var |
| FinReportDone | `PostMenu.tsx` view='report_done' (yeni) | Yeni (bu oturum) |
| FinReportNotice | `PostMenu.tsx` view='report_notice' (yeni, başarısız çağrı + "Tekrar dene") | Yeni (bu oturum) |
| doğrulama rozeti | `VerifiedBadge.tsx` (S4 import eder) | Var (ae9ed74) |
| FinMoLogA | `events.ts` `kcal:logFlight` + `MealCard.quickLog` (görsel kare ölçümü) | Var (ae9ed74) |
| FinMoLike | `PostCard.tsx` çift dokunma → beğen + kalp damgası | Var (ae9ed74) |
| FinMoLoad | `states.tsx` `FeedSkeleton` (shimmer, `useBreath`) + `KesfetScreen` `RefreshControl` (çek-yenile) | Var |
| FinMoSheet | `BottomSheet.tsx` (`useSheetRise`) — RulesSheet/PostMenu/AddToDaySheet/Comments ortak kabuğu | Var |

## 2) Light + Dark + EN

- Yeni bileşenler (RulesSheet, FeedTip, PostMenu'nün report_done/report_notice
  view'leri) yalnız `useTheme()` token'ı (`t.color.*`) kullanıyor; hardcoded hex
  YOK (`grep '#[0-9A-Fa-f]\{3,6\}'` → yalnız PostMenu'nün ÖNCEDEN var olan
  delete/block onay düğmesindeki `#FFFFFF`, `t.color.danger` zemin üstünde sabit
  — iki temada da doğru).
- EN: `kesfet.ui.rules.*`, `kesfet.ui.report_notice_*`, `kesfet.ui.feed_tip`
  tr+en birlikte yazıldı (`src/core/i18n/dictionaries.ts`); `report_done_*` TR
  önceki oturumdan (commit edilmemiş) kalmıştı, bu oturum EN karşılığını ekledi.
  `i18n.test.ts` "TR ve EN aynı üst seviye namespace'leri taşır" geçti.

## 3) FinStressLong/XL/EN kabul

- Yeni metinler `AppText` ile (fontSize sabit `numberOfLines` YOK) — typography.ts
  kuralı "gövde/caption serbest büyüsün, kap içinde sarmalasın" (satır 96-99)
  birebir uygulanıyor; RulesSheet/FeedTip/PostMenu-notice container'ları
  `flex:1`/`alignSelf:'stretch'`, sabit genişlik kırpması yok.
- Cihazda Dynamic Type XL / EN uzun metin render testi bu oturumda YAPILMADI
  (simülatör erişimi yok); statik denetim: hiçbir yeni satır `numberOfLines={1}`
  almıyor, dolayısıyla taşma riski mevcut bileşenlerle aynı sınıfta. SORULAR'a
  not edildi.

## 4) Dokunma ≥44 — denetim + düzeltmeler

Taranan: `src/modules/kesfet/ui/*.tsx` tüm `Pressable` + `minHeight`/`width`/
`height` değerleri.

- **Gerçek ihlal + düzeltildi** — `MealCard.tsx` `logBtn` (Final h32): iç
  `Pressable`lar (`logLabelTouch`, `logCaret`) `minHeight:44` veriyordu; row
  `alignItems:'center'` + açık `height` olmadığından Yoga satırı en uzun
  çocuğa (44) göre büyütüyordu → render'da fiili yükseklik 32 değil 44 oluyordu
  (Final'den sapma). Düzeltme: `logBtn` artık `height:32` (sabit, Final birebir),
  iç Pressable'lardan `minHeight:44` kaldırıldı, yerine `hitSlop`
  (`{top:8,bottom:8,left:4-6,right:4-6}`) ile dokunma alanı büyütüldü — görsel
  pil 32px, dokunma alanı ≥44 (32+16).
- **hitSlop eklendi (<44 pil/düğme, görsel boyut korunarak)**:
  `ActivityCard.didItBtn` (40→+8), `ComposerScreen.shareBtn` (36→+8),
  `ComposerScreen.segmentItem` (38→+4), `ComposerScreen.searchToggle` (36→+8),
  `ComposerScreen.chip` (etkinlik türü, 34→+5), `CommentsSheet.sendBtn` (40→+4),
  `states.followBtn` (36→+8), `TrackerActivityEntry.addBtn` (34→+5),
  `TrackerActivityEntry.chip` (34→+5).
- **Zaten uygun (inceleme, değişiklik yok)**: `PostCard` aksiyon satırı
  (`minHeight:44`), `AddToDaySheet.chipTouch` (`minHeight:44`, iç `chip` salt
  görsel), `CommentsSheet.menuRow` (`minHeight:48`), `EditPostSheet` düğmeleri
  (`minHeight:52`), `NotificationsSheet` satırı (avatar 40 + dikey pad 10 ⇒
  ≥60), `GunRingStrip.plusBadge` (22×22 — ayrı dokunma değil, tüm `item`
  (68 genişlik) zaten `Pressable`).
- Metin: `caption` varyantı `fontSize:13` (typography.ts satır 85-92, S1
  sahipliğinde DONUK token) — "yardımcı metin ≥13" zaten sistem genelinde
  sağlanıyor, yeni bileşenler de bu varyantı kullanıyor.

## 5) Cam

Keşfet'te `BlurView`/`glass`/`backdropFilter` arama: SIFIR eşleşme
(`grep -rln 'BlurView\|glass\|Glass' src/modules/kesfet/`). Foto üstü etiketler
(rol çipi, VerifiedBadge, P/K/Y çipleri) opak zeminler kullanıyor
(`t.color.line`/`t.color.surface`/`t.color.accent`) — kural zaten sağlanıyordu,
değişiklik gerekmedi.

## 6) Testler

- `npx tsc --noEmit` → 0 hata.
- `npm run test:unit` → 429/429.
- `npx jest` (test:components) → 67/67 (önceki 56 + yeni 11: RulesSheet 3,
  ComposerRules 4, FeedTip 2, PostMenu +2 [report_done/report_notice]).
- `npx expo export --platform ios` → geçti (`dist/`, gitignored).
- Yeni testler: `RulesSheet.test.tsx`, `ComposerRules.test.tsx` (ComposerScreen
  "Gönder" ilk kez kuralları açar, kabul/vazgeç, ikinci kez açmaz),
  `FeedTip.test.tsx`, `PostMenu.test.tsx` (+ report_done/report_notice akışı).

## SORULAR
1. `Fin*.dc.html` panoları (FinReport/FinReportDone/FinReportNotice/FinRules/
   FinFeedTip dahil) render edilemeyen `dc-import` kabukları — gerçek metin/
   ölçü bu ortamdan okunamadı (`support.js` + harici render servisi gerekli).
   `report_done_*` (önceki oturumdan TR), `report_notice_*`, `kesfet.rules.*`,
   `feed_tip` metinleri bu oturumda YAZILDI (uydurma veri değil, orijinal arayüz
   metni — [N]/[Ad] gibi gerçek veri yer tutucusu değil). Tasarımcı onayı
   gerekirse `kesfet.ui.report_notice_*`, `kesfet.rules.*`, `kesfet.ui.feed_tip`
   anahtarları `dictionaries.ts`'te güncellenebilir.
2. FinReportNotice'in tam anlamı stub'dan çıkarılamadı; "şikayet gönderilemedi"
   (ağ/sunucu hatası) olarak yorumlandı — alternatif yorum "tekrar şikayet"
   (zaten şikayet edilmiş) olabilirdi; mevcut `report_content` RPC'si duplicate
   kontrolü dönmüyor (`client.ts:146-152`), bu yüzden ilk yorum seçildi.
3. Dynamic Type XL + EN uzun metin cihaz/simülatör testi yapılmadı (bkz. madde 3).

## ENTEGRASYONA
Yok — bu oturumun tüm değişiklikleri `src/modules/kesfet/**` ve
`src/core/i18n/dictionaries.ts` (yalnız `kesfet` ad alanı, tr+en) içinde;
S2 dosya sahipliği sınırları aşılmadı.

## Commit'ler
- `ae9ed74` — Final akış/kart giydir (logFlight/logUndo/toast, VerifiedBadge).
- `8f178e5` — Topluluk kuralları + şikayet sonuç adımları + dokunma ≥44.
