# G5-S4 — Paylaşım kartı + derin bağlantı (LOG)

## Özet (10 satır)
1. **Yapıldı:** Öğün paylaşım kartı (cihazda SVG→PNG, yeni paket YOK), derin
   bağlantı altyapısı (iOS Universal + Android App Links, `l.eatkcal.com`),
   landing `.well-known` + `/p` `/u` önizleme sayfaları. 4 maddenin hepsi tamam.
2. **Kart:** `react-native-svg` `toDataURL` → `expo-file-system/legacy` → `expo-sharing`.
   Bayrak `paylasim_karti` (varsayılan KAPALI); yalnız Tracker'da "Bugün Tüketilenler"
   satırında bayrak açıkken paylaş düğmesi görünür. Kartta hedef/gün toplamı YOK.
3. **Derin bağlantı:** `app.config.js` associatedDomains + intentFilters; React
   Navigation `linking` (`/p/:postId`→SharedPost, `/u/:handle`→SharedProfile).
   `filter` ile auth-callback/payment-callback KORUNDU (çakışma yok).
4. **Giriş sonrası hedef:** linking initial-state ile WelcomeGate/authLoading'i ezer;
   hedef korunur (ek koda gerek kalmadı — detay aşağıda).
5. **Kontrol:** `tsc --noEmit` = 0, `npm run test:unit` = 305/305, `expo export ios` = OK.
6. **Deploy YOK.** Migration'lar yalnız dosya (uygulanmadı, staging'de test edilmedi).
7. **Kalan (İlter):** `l.eatkcal.com` Vercel domain + Cloudflare CNAME, Play SHA-256
   parmak izi (assetlinks), App Store numarası (önizleme düğmesi), YENİ BUILD.
   Ayrıntı: `docs/night/G5-S4-LINKS.md`.
8. **Üretim etkisi:** YOK. Kart kapalı bayrak arkasında; derin bağlantı mevcut 1.0.7
   cihazlarda pasif (domain + yeni build gelene kadar). Çalışan akışlar bozulmadı.
9. **Dal:** `night5/share-links` (night5/base'den), worktree `.claude/worktrees/g5-s4`.
10. **Commit'ler:** aşağıda "Commit'ler" başlığında.

---

## Madde 1 — Paylaşım kartı
**Amaç:** Kullanıcı bir öğünü (kalori/protein tahminiyle) sistem paylaşım sayfasından
paylaşsın. Kişisel hedef ve gün toplamı paylaşılmaz.

**Görüntü üretimi (yeni paket YOK):** `react-native-svg` v15.12.1 `<Svg>` ref'inin
`toDataURL(cb)` metodu kartı PNG base64'e çevirir (iOS/Android native). Base64,
`expo-file-system/legacy` `writeAsStringAsync` ile `cacheDirectory`'ye yazılır,
`expo-sharing` `shareAsync` ile paylaşılır. Bu zincir uygulamada zaten kanıtlı
(TrackerScreen PDF export: expo-print + Sharing). Raster logo KULLANILMADI — kart
tamamen vektör+metin, böylece `toDataURL` yakalaması her iki platformda güvenilir.

**Çözünürlük:** Kart 1080×1350 (4:5) tam boy render edilir; önizlemede
`transformOrigin:'top left'` + `scale` ile küçültülür → yerleşim boyutu tam kalır,
`toDataURL` tam çözünürlük yakalar.

**Dosyalar:**
- `src/lib/shareCard.ts` — `captureSvgToPngBase64` (data: ön ekini normalize eder,
  8 sn timeout) + `sharePngBase64` (dosya adı slug + seed; sağlık verisi yok).
- `src/components/share/MealShareCard.tsx` — `forwardRef` SVG kart. Alanlar: marka,
  "TAHMİN" etiketi, öğün adı (≤2 satır sarılır), porsiyon (ops.), kalori + protein.
- `src/components/share/ShareMealCardModal.tsx` — önizleme + "Paylaş" modalı.
- `src/screens/TrackerScreen.tsx` — `useFeature('paylasim_karti')` ile bayrak-gizli
  paylaş düğmesi (satır 2212 civarı) + modal mount (ScreenContainer kapanışında).
- `src/core/flags/registry.ts` — `paylasim_karti: false` eklendi.
- `src/components/icons.ts` — `ShareNetwork` eklendi.
- `supabase/migrations/20261103020000_paylasim_karti_flag.sql` (+ rollback) —
  bayrağın `feature_flags` kaydı (enabled=false). UYGULANMADI.

**Not:** `ConsumedRow.protein` karta geçer; yoksa kart tek kutu (kalori) gösterir.
Porsiyon alanı `note`'tan beslenir (varsa).

## Madde 2 — Derin bağlantı
**app.config.js:**
- `ios.associatedDomains: ['applinks:l.eatkcal.com']`
- `android.intentFilters` — `VIEW` + `autoVerify`, host `l.eatkcal.com`, pathPrefix
  `/p` ve `/u`, BROWSABLE+DEFAULT.

**React Navigation linking (`src/navigation/linking.ts`):**
- prefixes: `Linking.createURL('/')` (kcal://), `https://l.eatkcal.com`, `http://...`.
- config: `SharedPost: 'p/:postId'`, `SharedProfile: 'u/:handle'`.
- `filter`: `auth-callback` ve `payment-callback` içeren URL'leri React
  Navigation'dan GİZLER — bu geri dönüşler `AuthContext`/`payment.ts` tarafından
  expo-linking ile MANUEL işleniyor; çifte işleme/yanlış yönlenme engellendi.
- Push bildirim derin bağlantıları Linking URL'i değil, bildirim datası +
  `resolveNavigation` (`src/lib/navigation.ts`) ile işlenir → çakışma YOK.

**Yeni ekranlar (yalnız /p /u ile erişilir):**
- `src/screens/share/SharedPostScreen.tsx` (`/p/:postId`)
- `src/screens/share/SharedProfileScreen.tsx` (`/u/:handle`)
- `src/components/share/DeepLinkLanding.tsx` — ortak, herkese açık iniş ekranı.
- Sosyal katman (gönderi/profil/handle) HENÜZ YOK → ekranlar hafif yer tutucu;
  "Uygulamayı aç" ile `Tabs`'e reset eder. URL'de yalnız opak post_id / handle
  bulunur (ham UUID veya sağlık verisi yok).
- `src/navigation/types.ts` + `src/navigation/AppNavigator.tsx` — rota kaydı (lazy).

**Giriş sonrası hedef korunur:** React Navigation linking, eşleşen bir açılış URL'i
olduğunda navigasyon durumunu doğrudan URL'den kurar ve `initialRouteName`
(WelcomeGate/Tabs) yerine hedefi (SharedPost/SharedProfile) aktif yapar. `AppNavigator`
`authLoading` boyunca `null` döndürse de, NavigationContainer mount kalır; stack
mount olunca linking hedef state'i uygular. Böylece soğuk açılış + oturum çözümü
boyunca hedef kaybolmaz; ekstra koda gerek kalmadı. (Ekranlar herkese açık olduğu
için ayrıca Login'e zorlama yapılmaz — web önizlemesiyle parite.)

## Madde 3 — landing-page
- `landing-page/.well-known/apple-app-site-association` — `appIDs:
  ['A63MT69ASR.com.kcalmobile.app']`, components `/p/*` ve `/u/*` (+ webcredentials).
- `landing-page/.well-known/assetlinks.json` — package `com.kcalmobile.app`,
  sha256 parmak izi **yer tutucu** (İlter dolduracak).
- `landing-page/p.html`, `landing-page/u.html` — hafif, koyu/yeşil temalı statik
  önizleme; "Uygulamada aç" (kcal:// şema) + App Store / Google Play düğmeleri.
  Play linki dolu; App Store numarası yer tutucu (`#`). JS ile yoldan id/handle okur.
- `landing-page/vercel.json` — rewrites `/p/:postId`→`/p.html`, `/u/:handle`→`/u.html`;
  AASA + assetlinks için `Content-Type: application/json` header.

## Kontroller
- `npx tsc --noEmit` → **0 hata**.
- `npm run test:unit` → **305 pass / 0 fail**.
- `npx expo export --platform ios` → **OK** (iOS bundle üretildi; çıktı repo dışına,
  job tmp'ye yazıldı, repoya girmedi).
- Panel build / eas / vercel / supabase db → ÇALIŞTIRILMADI (deploy yok kuralı).

## Commit'ler
(Dal: `night5/share-links`)
- `1c9f712` — feat(paylasim): öğün paylaşım kartı + paylasim_karti bayrağı
- `b180096` — feat(derin-baglanti): l.eatkcal.com universal/app links + /p /u ekranları
- `fbe122a` — feat(landing): .well-known AASA/assetlinks + /p /u önizleme + vercel
- (bu dosya) — docs(gece-s4): G5-S4-LINKS + G5-S4-LOG

## SORULAR
Bkz. `docs/night/G5-S4-LINKS.md` → "SORULAR" (alan adı onayı, Android parmak izi
kaynağı, önizleme sayfalarının dinamikleşmesi). Ek olarak:
- **Paylaşım kartı tetiği** şu an yalnız Tracker "Bugün Tüketilenler" satırında.
  İleride "Tabak Röntgeni"/öğün detayına da eklensin mi? (Kart bileşeni hazır,
  `ShareMealData` ile her yerden çağrılabilir.)
