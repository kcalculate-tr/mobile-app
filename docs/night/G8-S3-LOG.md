Bu dal mağaza sürümüne MUTLAKA girmeli (yerel paket)

# G8-S3 — Mobil: video altyapısı + yerel paketler · LOG

## Özet (10 satır)
1. Dal `night8/video` (taban `night7/release`), worktree `.claude/worktrees/g8-s3`. G8-S1 (sunucu) ve G8-S2 (composer) bu gece henüz koşmadı — bu oturum tamamen ileriye dönük istemci iskeleti; `kesfet_video` bayrağı varsayılan `false`, bugünkü akışta hiçbir görsel/davranış farkı yok.
2. Onaylı istisna kullanıldı: `npx expo install expo-video expo-video-thumbnails expo-clipboard` — başka paket kurulmadı.
3. `src/modules/media/video/`: `pickVideo()` (galeri, `videoMaxDuration:60`, orta kalite, seçim sonrası süre/boyut AYRICA doğrulanır — OS garantisi yok), `extractFrames(uri, durationMs)` (başı/ortası/sonu 3 JPEG), `uploadVideoPost()` (`fetch(uri).blob()` + `post-media` kovasına `posts/{uid}/{mediaId}/...`; video+3 kare; `thumb_path` = başı karesi yeniden kullanılır — ayrı "kapak" yüklemesi yok). Çıktı (`VideoPostMedia`) G8-CONTRACT `post_media` alanlarıyla (kind/duration_s/thumb_path/frame_paths) BİREBİR.
4. `VideoPreview` (composer, yerel dosya, her zaman sessiz otomatik oynat) ve `FeedVideo` (akış): `expo-video`; görünür+aktifken sessiz oynat, değilse durdur, dokununca ses aç/kapat, köşede tam ekran düğmesi. Tek-video kuralı `activeVideo.ts` (zustand) ile: görünür olan kendini "aktif" ilan eder, diğerleri durur.
5. Veri tasarrufu/düşük güç modu: onaylı pakette battery/low-power API yok; `useAutoplayAllowed.ts` NetInfo `isConnectionExpensive`'i vekil olarak kullanıyor (iOS Düşük Veri Modu'nu kapsar, gerçek düşük güç modunu kapsamaz) — SORU 1'de detay.
6. `kesfet_video` bayrağı registry'ye eklendi (varsayılan false). `FeedMedia` tipine opsiyonel `kind/duration_s/thumb_path` eklendi (additive — sunucu göndermediği sürece `undefined`, davranış aynı). `MediaGrid`/`PostCard` `kind==='video' && kesfet_video` ise `FeedVideo` çizer, değilse öncekiyle AYNI `Image`; `KesfetScreen`'in `FlatList`'ine `onViewableItemsChanged` eklendi (ekranda görünen gönderi id'si → `isVisible`).
7. "Bağlantıyı kopyala" artık gerçek kopyalama: `KesfetScreen.onCopyLink` → `expo-clipboard` `setStringAsync`; sistem paylaşım sayfasına düşen eski davranış (+ `kesfet.ui.link_shared` i18n anahtarı) kaldırıldı, yerine `kesfet.ui.link_copied` (TR/EN).
8. `app.config.js`: kamera/mikrofon/foto izinleri video'yu da kapsayacak şekilde güncellendi; `expo-image-picker` eklentisine `microphonePermission` eklendi (Android `RECORD_AUDIO`'yu otomatik ekler); top-level `locales: {tr,en}` + `locales/{tr,en}.json` ile TR/EN izin metinleri (prebuild'de `ios/*/Supporting/{tr,en}.lproj/InfoPlist.strings` olarak doğrulandı).
9. Pure mantık (`rules.ts`: süre/boyut sınırı, kare zaman damgaları, depolama yolu) `tsx --test` ile test edildi; RN'e bağlı kısımlar (pickVideo/extractFrames/uploadVideoPost/UI) native modül gerektirdiği için simülatörde elle test EDİLMEDİ (bu gece kapsamı dışı — aşağıda not).
10. Kontrol: **tsc 0**, **`npm run test:unit` 386/386** (+5 yeni video testi), **`npm run test:components` 4 suite/30 test geçti**, **`npx expo prebuild -p ios --no-install` başarılı**, **`npx expo export --platform ios` başarılı**.

## Yapılanlar (madde madde)

### 1 — Paket kurulumu
`npx expo install expo-video expo-video-thumbnails expo-clipboard` → `package.json`/`package-lock.json` güncellendi. Başka paket kurulmadı.

### 2 — `src/modules/media/video/` (sunucudan/kesfet'ten bağımsız, yeniden kullanılabilir)
- `types.ts`: `PickedVideo`, `VideoFrame(s)`, `VideoPostMedia` (G8-CONTRACT post_media alanları), hata sınıfları (`VideoTooLongError`, `VideoTooLargeError`, `VideoUploadCancelledError`), `MAX_VIDEO_DURATION_S=60`, `MAX_VIDEO_BYTES=50MB`.
- `rules.ts` (SAF, native import yok): `assertVideoDuration/Size`, `frameTimestampsMs` (uçlarda 150ms pay — siyah kare riski), `storagePathFor(uid, mediaId, fileName)`.
- `pickVideo.ts`: `expo-image-picker` galeri, `videoMaxDuration:60`, `videoQuality:Medium`; `asset.fileSize` boşsa (bazı Android ContentProvider'ları vermiyor) `expo-file-system` ile dosyadan okunur — 50 MB kontrolü asla atlanmaz.
- `extractFrames.ts`: `expo-video-thumbnails` ile 3 kare (`frameTimestampsMs` zaman damgaları).
- `uploadVideoPost.ts`: `fetch(uri).blob()` deseni (SupportScreen.tsx'teki ek yükleme ile aynı — avatarUpload.ts'in base64 çevrimine göre büyük dosyada bellek dostu); 3 kare + video `post-media/posts/{uid}/{mediaId}/...` altına yüklenir; `onProgress`/`isCancelled` adım bazlı (byte bazlı ilerleme supabase-js RN'de yok).
- `activeVideo.ts`: zustand, tek aktif video id'si.
- `useAutoplayAllowed.ts`: NetInfo `isConnectionExpensive` vekili (SORU 1).
- `ui/icons.tsx`, `ui/VideoPreview.tsx`, `ui/FeedVideo.tsx`: yukarıda özetlendi.
- `__tests__/rules.test.ts`: 5 test (süre/boyut sınırı, kare zaman damgaları, depolama yolu).

### 3 — Keşfet'e bağlama (additive, bayrak kapalıyken davranış AYNI)
- `src/core/flags/registry.ts`: `kesfet_video: false`.
- `src/modules/kesfet/types.ts`: `FeedMedia` → opsiyonel `kind/duration_s/thumb_path`.
- `src/modules/kesfet/ui/MediaGrid.tsx`: `Cell` artık `postId`/`isVisible` alıyor; `kind==='video' && kesfet_video` ise `FeedVideo`, değilse (bayrak kapalı YA DA sunucu `kind` göndermiyor — bugünkü durum) öncekiyle birebir aynı `Image` (video ise `thumb_path`'ten kapak gösterilir, yoksa `url`).
- `src/modules/kesfet/ui/PostCard.tsx`: `isVisible` prop'u `MediaGrid`'e iletir.
- `src/modules/kesfet/ui/KesfetScreen.tsx`: `FlatList`'e `viewabilityConfig`(`itemVisiblePercentThreshold:60`) + `onViewableItemsChanged` → `visiblePostId` state → `PostCard.isVisible`.
- `onCopyLink`: `Share.share` yerine `Clipboard.setStringAsync(postLink(post.id))`; toast `kesfet.ui.link_copied`.
- `src/core/i18n/dictionaries.ts`: `kesfet.ui.link_shared` → `kesfet.ui.link_copied` (TR/EN; eski anahtar artık hiçbir yerden çağrılmadığı için kaldırıldı).

### 4 — `app.config.js` / izinler
- iOS `infoPlist`: `NSCameraUsageDescription`/`NSPhotoLibraryUsageDescription` video'yu da kapsayacak şekilde genişletildi (mevcut amaç — profil fotoğrafı/ürün görseli — korunarak); yeni `NSMicrophoneUsageDescription`.
- `expo-image-picker` eklenti seçenekleri: `cameraPermission`/`photosPermission` metinleri güncellendi, yeni `microphonePermission` (Android `RECORD_AUDIO`'yu otomatik ekler — ayrıca elle `android.permissions`'a eklenmedi, expo-image-picker eklentisi zaten ekliyor).
- `plugins`'e `'expo-video'` eklendi (expo install'un istediği).
- Yeni top-level `locales: { tr: './locales/tr.json', en: './locales/en.json' }` + bu iki dosya (Camera/Microphone/PhotoLibrary/PhotoLibraryAdd metinleri TR+EN). Prebuild çıktısında doğrulandı: `ios/Kcalculate/Supporting/{tr,en}.lproj/InfoPlist.strings` doğru metinlerle üretildi.

## Kontrol sonuçları
- `npx tsc --noEmit` → 0 hata.
- `npm run test:unit` → tests 386, pass 386, fail 0 (+5 video `rules` testi; önceki 381'den artış).
- `npm run test:components` (jest) → 4 suite, 30 test, hepsi geçti.
- `npx expo prebuild -p ios --no-install` → `Finished prebuild`; `ios/` gitignore'da, commit edilmedi. `NSMicrophoneUsageDescription` + TR/EN `InfoPlist.strings` doğrulandı.
- `npx expo export --platform ios` → başarılı (`dist/`, 8.23 MB bundle); `dist/` gitignore'da, commit edilmedi.

## SORULAR / Kararlar
1. **Düşük güç modu tespiti**: Onaylı üç paket (`expo-video`, `expo-video-thumbnails`, `expo-clipboard`) battery/low-power API sağlamıyor; `expo-battery` yeni paket kurma yasağına giriyor. `useAutoplayAllowed.ts` NetInfo `isConnectionExpensive`'i vekil kullanıyor — iOS "Düşük Veri Modu"nu ve pahalı hücresel ağı kapsar ama gerçek "Düşük Güç Modu"nu (ekran/CPU tasarrufu) KAPSAMAZ. Kabul edilebilirse aynen kalsın; `expo-battery` onaylanırsa ayrı bir dokunuşla eklenebilir.
2. **`post-media` kova sınırı bugün 5 MB/yalnız görsel** (`supabase/migrations/20261104000400_post_media_storage.sql`, yorum: "Dalga 1'de yalnız görsel"). Bu oturum kovayı DEĞİŞTİRMEDİ (G8-S1'in işi — "video türleri (mp4/mov) ≤ 50 MB" G8-S1.md m.4). İstemci tarafı 50 MB/60 sn sınırı `pickVideo`'da bağımsız uygulanıyor ama G8-S1 kova politikasını genişletmeden gerçek cihazda video yükleme sunucu tarafında reddedilir — composer (G8-S2) bu modülü kullanmaya başlamadan önce G8-S1'in migration'ı canlıya/ilgili ortama uygulanmalı.
3. **`post_media.kind/duration_s/thumb_path/frame_paths` kolonları henüz YOK** (`20261104000200_feed_tables.sql` — "Dalga 1'de yalnız görsel (video yok)"); G8-S1'in `20261104002000_g8_social.sql`'i (bu gece henüz yazılmadı) ekleyecek. `VideoPostMedia`/`FeedMedia` tipleri bu sözleşmeyi önceden yansıtıyor; G8-S1 iner inmez `uploadVideoPost()` çıktısı doğrudan `create_post`'un `p_media[]`'ına verilebilir — ekstra dönüşüm gerekmez.
4. **`FeedVideo` gerçek bir video post'uyla simülatörde test EDİLMEDİ** — bugün hiçbir `get_feed` sonucu `kind:'video'` döndürmüyor (G8-S1 yok) ve composer henüz video seçtirmiyor (G8-S2 yok). Bayrak kapalıyken kod yolu da zaten eski `Image`'a düşüyor; entegrasyon testi G8-S1+S2 indikten sonra yapılmalı.
5. **`kesfet_video` için sunucuda `feature_flags` satırı yok** — diğer bayraklarla aynı (G4-S2-FLAGS deseni); açılış kararı/satır ekleme İlter'e.

İlgili: [G8-CONTRACT.md](../../.claude/night/G8-CONTRACT.md), [G8-S1.md](../../.claude/night/G8-S1.md), [G8-S2.md](../../.claude/night/G8-S2.md), [G7-S1-LOG.md](./G7-S1-LOG.md).
