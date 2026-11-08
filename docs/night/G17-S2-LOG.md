# G17-S2 — Canlı kamera + tab bar (7 Kas)

## ÖZET (10 satır)
(1) **Tara canlı kamera (md.1):** sekmedeki Tara → doğrudan FinScanR2 canlı vizör (`expo-camera` `CameraView`, tam ekran): köşe çerçevesi, "Tabağı tam çerçevele", Fotoğraf · Barkod · Elle, lime deklanşör, galeri (ImagePicker), flaş (fotoğrafta `flash`, barkodda `enableTorch`), hak hapı. "Kamerayı aç" kartı ve sistem kamerası yeni derlemede KALKTI.
(2) **Deklanşör + FinMoScan (md.2):** `takePictureAsync` kalite 0.5, `pictureSize` ile uzun kenar ≤ 1600; aynı ekranda donmuş kare + flaş 200 + çerçeve daralır (300 standard) + tarama çizgisi + lime nokta nefesi + "Analiz ediliyor" ve üç nokta; sonuç gelince FinPhotoR1 sheet'i AI 260/24 yayıyla yerleşir (azaltılmışta 200 ms opaklık, flaş/çizgi yok, nokta sabit). Haptik medium → success.
(3) **İzin (md.3):** ilk açılışta kamera izni; reddedilirse FinScanError "Kameraya erişim kapalı" + Ayarlar; Ayarlar'dan dönünce yeniden denetlenir. `app.config` `expo-camera` eklentisi `cameraPermission` = `locales/tr.json` ios metni; Android yalnız CAMERA (RECORD_AUDIO eklenmez).
(4) **Barkod (md.4):** EAN-13/8, UPC-A/E okunur + sağlama doğrulanır; uygulamada barkod akışı YOK → "Barkod yakında" kartı (okunan kod gösterilir, sahte ürün/sonuç yok) + "Elle gir".
(5) **Tab bar (md.5):** seçili sekme YARI SAYDAM gri hap — açık `rgba(10,10,10,0.08)`, koyu `rgba(255,255,255,0.14)`; ikon/etiket normal mürekkep (beyaz ikon yok); kayma 200 standard (yay/jöle yok).
(6) **analyze-ai-scan 500 (md.6):** istemci edge gövdesindeki `error` kodunu (config/server/timeout/parse/model/…) + HTTP durumu + aşamayı (reserve/upload/analyze) `console.warn('[ai-scan] başarısız', …)` ve Sentry'ye (`captureError`, kişisel veri yok) yazar; kullanıcı FinErrFailed, hak iadesi aynen. Sunucu DEĞİŞMEDİ.
(7) Kontrol: tsc 0 · unit 641 (640 ✓, 1 skip önceden) · components 30 suite / 156 ✓ (snapshot 2/2) · prebuild iOS ✓ (+ pod install + xcodebuild BUILD SUCCEEDED) Android ✓ · export iOS ✓ (9.4 MB) Android ✓ (9.5 MB). **Simülatörde doğrulandı** ("G17-2 iPhone", gerçek expo-camera derlemesi): canlı vizör, deklanşör → FinMoScan analiz katmanı → sonuç sheet'i; tab bar gri hap açık + koyu.
(8) **Bayrak kapalı parite:** `yeni_kabuk` kapalıyken Tara ağacı `night17/fix` tabanındaki ScanScreen ile birebir (snapshot tabanda üretildi) ve expo-camera HİÇ yüklenmez; tab bar değişikliği yalnız yeni kabukta (TabBarR3).
(9) **YENİ NATIVE DERLEME GEREKİR** (expo-camera): OTA ile gelen JS eski derlemede çökmesin diye `requireOptionalNativeModule('ExpoCamera')` yoksa G17-S1 kartı (sistem kamerası) yedeği. EAS'i İlter çalıştırır.
(10) SORULAR: 3 madde (canlı edge log okuması izinle reddedildi; disk neredeyse dolu; Tur 26 panoları G18'e). Son commit GERÇEK dosya `docs/night/G17-S2-DONE`.

## Commit'ler
| Madde | Commit | Özet |
|---|---|---|
| 5 | `0600b1c` | Tab bar seçili hap: `shell/selectedPill.ts` (açık `rgba(10,10,10,0.08)` / koyu `rgba(255,255,255,0.14)`, mürekkep ikon/etiket), kayma `withTiming(200, CURVE.standard)`; test `selectedPill.test.ts` 4/4 |
| 6 | `55d96e1` | `scanError.ts` (edge `error` kodu + HTTP durumu + aşama), `client.analyzeImage` → `ScanStageError`, `client.reportFailure` → `console.warn` + Sentry, `runAiScan` aşama izler; test `scanError.test.ts` 7/7 |
| 3 | `4ae6f1e` | `npx expo install expo-camera` (~17.0.10, YALNIZ bu paket) + `app.config.js` eklentisi; test `cameraConfig.test.ts` 3/3 |
| 1·2·3·4 | `bfb0d17` | `ui/FinScanCamera.tsx` (canlı vizör, izin, flaş/torch, barkod), `ui/FinScanAnalyzing.tsx` (FinMoScan), `camera.ts` (boyut seçimi, GTIN doğrulama), `FinPhotoResult` sheet AI 260/24, i18n TR+EN; testler `camera.test.ts` 9/9, `FinScanCamera.test.tsx` 7/7, `ScanScreen.flagParity.test.tsx` 3/3 |
| 1·2 | `85fc6a4` | Deklanşör `onCameraReady`'ye bağlı değil (iOS simülatöründe olay gelmez), boyut listesi görüntü açılınca da istenir; vitrinde gecikmeli bellek içi AI istemcisi |
| — | `b55b560` | Başlık notları |
| 2 | `3ac916a` | Vitrin `FinMoScan` = canlı Tara + yalnız `__DEV__` otomatik deklanşör olayı |
| 1 | `e50570f` | Kamera ekranında durum çubuğu açık renk (simülatör çekiminde bulundu) |
| 7 | `08323ed` | Vitrin katalog testi: 8 Kas'ta design/final/png'ye eklenen Tur 26 panoları G18'e bekleyen liste; FinOnbIntent Final'den çıktı (taban `night17/fix`'te de aynı test kırılıyordu) |
| 7 | bu LOG + `G17-S2-DONE` | Kontroller |

## 1 — Tara canlı kamera
- Giriş: `TabBarR3.onScanPress` zaten kök `AiScan`'i açıyor (ara ekran yok). `ScanScreen` yeni kabukta `loadExpoCamera()` → `FinScanCamera`.
- `FinScanCamera`: `CameraView` tam ekran (`facing="back"`, `mode="picture"`, `animateShutter={false}`, `active` = hata sheet'i/analiz yokken). Üst: kapat X sağda (G17-S1 gezinme kuralı) + "Bugün N/3 tarama hakkın kaldı". Orta: `ScanFrame` köşeleri (canlı görüntü üstünde beyaz — koyu sahnede kaybolmasın) + cam hap "Tabağı tam çerçevele". Alt: Fotoğraf · Barkod · Elle (tablist), galeri karesi (ImagePicker kütüphanesi — KALDI), lime deklanşör (basışta 0.9), flaş (switch; açıkken lime daire).
- "Kamerayı aç" kartı + sistem kamerası yeni derlemede yok. **Güvenlik yedeği:** `requireOptionalNativeModule('ExpoCamera')` null ise (1.1.0 (25) ve öncesi; runtimeVersion `appVersion` olduğundan aynı sürüme OTA gidebilir) eski `FinScanViewfinder` gösterilir — `require('expo-camera')` native modülsüz çökerdi.

## 2 — Deklanşör + FinMoScan
- `takePictureAsync({ quality: 0.5, exif: false })`. expo-camera yeniden boyutlandırmaz, image-manipulator yasak → `pickPictureSize(getAvailablePictureSizesAsync())`: uzun kenarı ≤ 1600 olanların en büyüğü, 4:3 tercih (Android ör. `1600x1200`; iOS ön ayarlarından `1280x720`). Uygun boyut yoksa cihaz varsayılanı; yükleme yine 5 MB sınırında (`scanPath.MAX_SCAN_IMAGE_BYTES`).
- Çekilen URI → mevcut `runFinCapture` (çevrimdışı kuyruk, reserve → upload → analyze, hata → iade + FinErrFailed) AYNEN.
- `FinScanAnalyzing` (analiz sürerken, aynı ekran): donmuş kare + %28 karartma, beyaz flaş 0.8 → 0 (fast 200), çerçeve 1 → 0.86 (base 300 standard), lime tarama çizgisi (TIMING.sweep, döngü), 24 px lime nokta nefesi (slow 500 ↔, scale 1 ↔ 0.8, opaklık 1 ↔ 0.7 — FinMoScan `scl-dot4`), "Analiz ediliyor" + üç nokta (150 ms kademe). Döngü gerçek yanıt gelene dek sürer; optimistik sonuç yok.
- Sonuç: `FinPhotoResult` sheet'i (çok öğeli `sheet` + tek tabak `cutSheet`) `withSpring(SPRING.ai)` (260/24) ile 320 pt alttan yerleşir; azaltılmış harekette `withTiming(1, 200)` yalnız opaklık. Haptik: deklanşör medium → sonuç success.

## 3 — İzin akışı
- Açılışta `Camera.getCameraPermissionsAsync`; sorulabiliyorsa `requestCameraPermissionsAsync` (sistem metni = `NSCameraUsageDescription`). Red → `onPermissionDenied` → `FinScanErrorSheet kind="camera"` ("Kameraya erişim kapalı", Ayarlar'ı aç, galeriden seç, elle gir). `AppState` active → yeniden denetim; izin geldiyse sheet kapanır, canlı görüntü açılır.
- `app.config.js`: `['expo-camera', { cameraPermission: <locales/tr.json ios.NSCameraUsageDescription>, microphonePermission: <aynı dosyadaki metin>, recordAudioAndroid: false }]`. Android manifest (prebuild): `CAMERA` ✓; `RECORD_AUDIO` ÖNCEDEN var (expo-image-picker `microphonePermission`), kamera eklentisi eklemiyor.

## 4 — Barkod
Uygulamada barkod akışı yok (`grep -ri barcode src` → yalnız `flags/registry.ts:16 barcode_scan: false` ve mod etiketi; DB'de barkod tablosu yok). → Barkod modunda tarayıcı açılır (`barcodeScannerSettings: ['ean13','ean8','upc_a','upc_e']`), çerçeve yatay (0.56 oran), ipucu "Barkodu çerçeveye hizala", "Barkod yakında" kartı + "Elle gir". Okunan kod `normalizeBarcode` ile sağlama basamağından geçerse "Okunan barkod: …" gösterilir, tarama durur (tek okuma). Ürün/kalori sonucu UYDURULMAZ. Deklanşör barkod modunda pasif.

## 5 — Tab bar
G17-S1 md.10'un opak hapı (`#1C1C1E` + beyaz ikon / koyuda `#F5F5F5` + koyu ikon) geri alındı. Hap `rgba(10,10,10,0.08)` / `rgba(255,255,255,0.14)`, ikon kesik rengi normal (`g.cut`), etiket 600 + `selected` erişilebilirlik durumu korunur. Kayma 200 standard; azaltılmışta 200 (REDUCED). Jöle uzaması kaldırıldı (Instagram sadeliği). Yalnız `TabBarR3` (yeni kabuk); eski `CustomTabBar` değişmedi (TabBarR3.test eski kabuk paritesi ✓).

## 6 — analyze-ai-scan 500 teşhisi
- Kök: `functions.invoke` non-2xx'te yalnız "Edge Function returned a non-2xx status code" verir; gövde (`supabase/functions/analyze-ai-scan/index.ts`: `config` 500 :107, `server` 500 :121, `model` 502 :175, `timeout` 504 :183, `parse` 502 :193 …) kayboluyordu. ~200 ms'lik 500, model çağrısından ÖNCEKİ bir dalı düşündürüyor (`config` = `ANTHROPIC_API_KEY` yok :107 ya da `server` = rezervasyon okuma hatası :121) — doğrulanamadı (SORULAR 1).
- İstemci: `analyzeErrorFromInvoke` `FunctionsHttpError.context` (Response) gövdesinden kodu okur; ağ → `network`, relay → `relay`, JSON değil → `http_<durum>`. `runAiScan` catch: `reportFailure({stage, code, httpStatus})` → `console.warn('[ai-scan] başarısız', …)` + `captureError(ScanStageError, { ai_scan: … })` (yol/uid/foto YOK). Rezervasyon RPC hatası ScanScreen'de `stage: 'reserve'`. Kullanıcı: FinErrFailed; iade aynen.

## 7 — Kontroller
- `npx tsc --noEmit` → 0 hata.
- `npm run test:unit` → 641 test, 640 geçti, 0 kaldı, 1 atlandı (önceden var). Yeni: selectedPill 4, scanError 7, cameraConfig 3, camera 9.
- `npm run test:components` (jest) → 30 suite / 156 test geçti, snapshot 2/2 (yeni `ScanScreen.flagParity` snapshot'ı `night17/fix` tabanındaki ScanScreen ile üretildi, sonra yeni kodla `--ci` geçti).
- Bayrak kapalı parite: Tara snapshot birebir + `loadExpoCamera` çağrılmıyor; TrackerScreen flagOff snapshot ✓; TabBarR3 eski kabuk ✓; `noLegacyWhenFlagsOn` ✓.
- Prebuild: `expo prebuild --platform ios` ✔ "Finished prebuild"; `--platform android --no-install` ✔ (manifest CAMERA). İlk denemede `pod install` disk dolu (`No space left on device`) yüzünden düştü; ikinci denemede (yalnız aktif mimari, dizin deposu kapalı, boş alan < 400 MB olursa yalnız kendi sürecini durduran bekçi) `pod install` ✓ + `xcodebuild` **BUILD SUCCEEDED**.
- `expo export --platform ios` ✓ (9.4 MB) · `--platform android` ✓ (9.5 MB) — son commit'ten sonra yeniden.
- **Canlı kamera + tarama animasyonu — simülatör ("G17-2 iPhone", Metro 8100, vitrin storage modu):**
  - `FinScanR2`: gerçek `CameraView` bağlı (simülatörde görüntü siyah), beyaz köşe çerçevesi, "Tabağı tam çerçevele", hak hapı solda + X sağda, Fotoğraf · Barkod · Elle, lime deklanşör, flaş kapalı ikonu. "Kamerayı aç" kartı YOK. İlk çekimde durum çubuğu siyah zeminde koyu kalıyordu → `e50570f` ile açık renk, yeniden çekimde doğrulandı.
  - `FinMoScan` (otomatik deklanşör, 0,7 sn aralıklı 16 kare): ~4,9 sn → `takePictureAsync` simülatör karesi (tarih görüntüsü) donar, çerçeve daralmış, lime tarama çizgisi, lime nokta, "Analiz ediliyor" + üç nokta; ~5,6 sn → FinPhotoR1 sheet'i alttan yerleşmiş ("2 öğe bulundu", 640 kcal, makro halkaları, "Akşam'a logla").
  - `FinHomeR3` / `-Dark`: seçili "Ana sayfa" yarı saydam gri hap, ikon/etiket mürekkep (açıkta siyah, koyuda beyaz) — opak siyah/beyaz hap yok.
  - Kanıt görselleri: `.claude/night/out/g17-s2/` (worktree) + `~/kcal-reports/g17-s2/` — FinScanR2, FinMoScan-analiz, FinMoScan-sonuc, FinHomeR3, FinHomeR3-Dark.
- Bileşen testleri de aynı akışı kapsar: (`FinScanCamera.test.tsx`: izin iste → canlı görüntü, deklanşör → `takePictureAsync(0.5)` → `onCaptured`, analizde `fin-scan-analyzing` + "Analiz ediliyor" + önizleme duraklar, flaş/torch, barkod; `ScanScreen.flagParity`: bayrak açık → `fin-scan-camera`, kart yok). 

Eski tasarım: 0 (Tara bayrak açık yol: FinScanCamera / FinScanAnalyzing / FinPhotoResult / FinScanErrorSheet; eski `ScanLimitSheet`/`ScanFrame`-beyaz-eski dal yalnız bayrak kapalı). Yeniden giydirilen (Final'de yok): "Barkod yakında" kartı (Final kart diliyle).

## YENİ DERLEME GEREKİR
`expo-camera` native modül → OTA ile canlı kamera GELMEZ (eski derlemede yedek kart). EAS derlemesini İlter çalıştırır. Tab bar (md.5) ve hata teşhisi (md.6) JS — OTA ile de gider.

## Simülatör doğrulaması (tekrar çalıştırma)
```
# worktree/ios: pod install + xcodebuild -destination id=<UDID> ONLY_ACTIVE_ARCH=YES COMPILER_INDEX_STORE_ENABLE=NO CODE_SIGNING_ALLOWED=NO
xcrun simctl install EE3E3A0A-A2DC-4DC1-8D06-8CE0EA6AAB86 <dd>/Build/Products/Debug-iphonesimulator/Kcalculate.app
xcrun simctl privacy EE3E3A0A-A2DC-4DC1-8D06-8CE0EA6AAB86 grant camera com.kcalmobile.app
npx expo start --dev-client --port 8100
G14_MODE=storage G14_UDID=EE3E3A0A-A2DC-4DC1-8D06-8CE0EA6AAB86 G14_WAIT=4 scripts/dev/g14-shots.sh FinScanR2 FinMoScan FinHomeR3 FinHomeR3-Dark
```
Simülatör "G17-2 iPhone" (`EE3E3A0A-…AAB86`, `4FED1BB8` kopyası). Not: iOS simülatöründe kamera görüntüsü yoktur (siyah); `takePictureAsync` simülatörde üretilmiş bir kare döner → FinMoScan + sonuç akışı çekilebilir.

## SORULAR
1. **Canlı edge log okuması reddedildi** (`supabase-prod query_logs`, otomatik mod sınıflandırıcısı). 500'ün kodu bu oturumda doğrulanamadı; yeni istemci teşhisi ilk başarısız taramada Sentry'de `ai_scan.code` olarak görünecek (ya da Dashboard → Edge Functions → analyze-ai-scan logları). ~200 ms → büyük olasılıkla `config` (ANTHROPIC_API_KEY secret'ı yok) ya da `server`.
2. **Disk neredeyse dolu** (`/System/Volumes/Data` 426/460 GB; iş sırasında 209 MB–5 GB boş): ilk iOS derlemesi bu yüzden düştü, ikincisi küçük ayak iziyle geçti. Kural gereği eski worktree'ler (32 GB) ve DerivedData (6.4 GB) silinmedi; paralel oturumlar için yer açılması önerilir. Bu oturumun ürettikleri: worktree `ios/` (~1 GB) + DerivedData `~/.claude/jobs/8717c6d0/tmp/dd` (iş silinince gider).
3. **Tur 26 (8 Kas 19:37):** design/final/png'ye 22 yeni pano (FinOrient1–4, FinHomeFocusB/C, FinWaitlistAdd/Suggest, FinPush, FinOpen …) geldi, FinOnbIntent çıktı. Vitrin katalog testi `PENDING_TUR26` listesiyle geçiyor; G18 her panoyu uyguladıkça listeden silmeli.
