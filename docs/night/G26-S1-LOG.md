# G26-S1 — İzinleri azalt + plan adı tipografisi · 11 Kas 2026

Dal `release/1.1.0` (worktree `.claude/worktrees/g23-s1`, G25-S1 bitmiş: `docs/night/G25-S1-DONE` var). Yeni paket yok;
kaldırılan paket: `expo-tracking-transparency`. Deploy yok, canlı DB yazma yok, migration yok.

## ÖZET
1. Envanter `docs/night/G26-IZINLER.md`: her sistem izni + uygulama içi onay, önce/sonra dosya:satır, introspect listesi, Tercihler önerisi.
2. ATT kaldırıldı: paket + eklenti + `NSUserTrackingUsageDescription` (app.config, fbsdk eklentisi, locales TR/EN) + çağrılar gitti; iOS `setAdvertiserTrackingEnabled(false)` + IDFA kapalı sabit; Meta ATT'siz (AEM), yalnız uygulama içi "Reklam ölçümü" tercihine bağlı.
3. Konum: açılışta ve kayıt akışında sistem penceresi yok (il/ilçe elle + harita pini); yalnız "Konumumu kullan"/"İzin ver"e dokununca, reddedilirse bir daha sorulmaz.
4. Fotoğraflar: galeri izni hiç istenmiyor (sistem seçicisi) — 8 çağrı kalktı.
5. Kamera / mikrofon + konuşma tanıma: yalnız Tara'da kullanıldığı anda, bir kez; ret → açıklama + "Ayarlar'ı aç" (Koç ses panelinde de).
6. Bildirim: tek fonksiyon `src/core/push/pushPermission.ts`; sistem penceresi yalnız ilk öğün kutlaması sonrası tek açıklama ekranında ya da Ayarlar › Bildirimler'den (30 günde en fazla bir). Açılış 2,5 sn modalı, oturumda doğrudan istek, sosyal ön sayfa kaldırıldı.
7. Uygulama içi onaylar: oturum başına tek onay sheet'i (ertelenebilir bildirim teklifi ikinci olmaz); AI izni ilk taramada, koç izni ilk koç mesajında kaldı. Tercihler ekranı yapılmadı (öneri envanterde).
8. Plan adı: abonelik başarı başlığı "Balance etkin" (+ küçük "kcalAI" hapı), Profil › Abonelik büyük ad "Fresh"/"Balance" (+ "Mevcut kcalAI planın" küçük satır). Paywall, koçlu paywall, hak sheet'i zaten uygundu.
9. Kontroller: tsc 0 · hygiene OK · unit 1070/0 (1 atlanan) · jest 436/436 (77 dosya) · introspect (ATT yok, Android kullanılmayan 3 izin engelli) · expo export iOS + Android OK · HIG elle kod denetimi.
10. **Yeni native derleme gerekir** (ATT eklentisi/paket kalktı, Info.plist + gizlilik manifesti + Android manifest değişti) — OTA ile gitmez.

## Commit tablosu
| Madde | Commit | Özet |
|---|---|---|
| 2 | `9c54a7e` | ATT kaldırıldı; Meta ATT'siz; gizlilik manifesti `NSPrivacyTracking: false`; Ayarlar ATT engel satırı kalktı |
| 3 | `c6e44fd` | konum yalnız dokununca; `askOnce` (reddedilen izin bir daha sorulmaz) |
| 4 | `8ea5e1c` | galeri izinsiz sistem seçicisi; kaynak bekçi testi |
| 5 | `e6f7e16` | kamera + ses `askOnce`; Koç ses ret hâli (TR/EN) |
| 6 | `3ea3ecc` | bildirim tek fonksiyon; açılış modalı / doğrudan istek / sosyal ön sayfa kalktı |
| 7 | `8754c42` | oturum başına tek onay sheet'i |
| 8 | `5706a1c` | plan adı tipografisi |
| 9 | `34a2bfb` | Android `blockedPermissions`; nokta ayracı düzeltmesi; kilit `lib/permissions`'a |
| 1 | `ac87d06` | envanter + mağaza belgeleri |
| — | (bu commit) | LOG; ardından `G26-S1-DONE` |

## İzin listesi — önce / sonra
| | Önce (G25-S1 sonu) | Sonra |
|---|---|---|
| iOS Info.plist | Camera · Microphone · SpeechRecognition · PhotoLibrary · PhotoLibraryAdd · LocationWhenInUse · **UserTracking** | Camera · Microphone · SpeechRecognition · PhotoLibrary · PhotoLibraryAdd · LocationWhenInUse |
| iOS gizlilik manifesti | Tracking true, `ep1.facebook.com`, 3 izleme türü | Tracking false, alan yok, izleme türü yok |
| Android | INTERNET · VIBRATE · CAMERA · FINE/COARSE_LOCATION · RECORD_AUDIO · **READ/WRITE_EXTERNAL_STORAGE · SYSTEM_ALERT_WINDOW** | INTERNET · VIBRATE · CAMERA · FINE/COARSE_LOCATION · RECORD_AUDIO (3'ü `tools:node="remove"`) |
| Kayıt/onboarding sırasında sistem penceresi | ATT + bildirim (girişten hemen sonra), konum (eatkcal kayıt adres paneli), bildirim modalı (açılış 2,5 sn) | **Yok** |
| Açılışta sistem penceresi | ATT (bayrak kapalıyken), konum (adres yoksa), bildirim modalı | **Yok** |

## KARAR
1. **Gizlilik manifesti izleme = false**: ATT olmadan "izleme" beyanı Apple 5.1.2 ile çelişirdi (izleme varsa ATT şart). IDFA artık okunmuyor, `setAdvertiserTrackingEnabled(false)`; Meta olayları AEM toplu ölçümüyle gider. PurchaseHistory / ProductInteraction'da "Third-Party Advertising" amacı kaldı (Meta'ya gidiyor), DeviceID yalnız `anon_id` → Analytics. **ASC App Privacy'de "Data Used to Track You" boşaltılmalı** (SORULAR 1).
2. **Reklam ölçümü anahtarı kaldı**: ATT'ye bağlı değil, yalnız uygulama içi tercih (`metaAllowed = adConsent !== 'denied'`, iOS + Android). Varsayılan (unset) açık — bugünkü davranış.
3. **"Bir kez" kuralı = `askOnce`** (`src/lib/permissions/askOnce.ts`): izin varsa sormaz; bir kez reddedildiyse cihazda işaret (`@kcal_location_denied`, `@kcal_camera_denied`, `@kcal_speech_denied`) ve Android ikinci kez sorabilse de sistem penceresi açılmaz. İzin sonradan Ayarlar'dan verilirse okuma `granted` döner.
4. **Bildirim politikası** (`src/core/push/pushPolicy.ts`): ilk öğün teklifi yalnız hiç sorulmamış + `undetermined` kullanıcıya; sonrası otomatik teklif yok. Ayarlar › Bildirimler'de "Bildirimleri aç": son sistem penceresinden ≥ 30 gün geçtiyse ve işletim sistemi sorabiliyorsa pencere, aksi hâlde Ayarlar uygulaması. Kart artık hiç sorulmamış kullanıcıda da görünür ("Bildirimler kapalı… / Bildirimleri aç", TR/EN).
5. **Açılış bildirim modalı (`PushPermissionPrompt.tsx`) ve `SocialPushPrompt.tsx` silindi**: ikisi de kendi başına izin istiyordu (kural ihlali); "PushPermissionPrompt akışı" artık `core/push/pushPermission.ts` tek fonksiyonu. Eski kabukta (yeni kabuk bayrağı kapalı) ilk öğün kutlaması olmadığı için otomatik teklif yok — Ayarlar'dan açılır.
6. **Teklif yalnız `first` kutlamasından sonra** (eskiden ilk herhangi bir kutlama). Bu oturumda başka onay sheet'i açıldıysa teklif atlanır ve tekrar gelmez (ilk öğün tek seferlik) — kullanıcı Ayarlar'dan açabilir (SORULAR 4).
7. **Galeri anahtarları Info.plist'te kaldı**: kod artık `NSPhotoLibraryUsageDescription` gerektiren isteği yapmıyor, ama `expo-image-picker` ikili kodu PHPhotoLibrary yetki API'sine bağlı — anahtar yoksa App Store yüklemesi ITMS-90683 ile reddedilebilir. `NSPhotoLibraryAddUsageDescription` sistem paylaşım sayfası "Görüntüyü Kaydet" için gerekli.
8. **Android depolama izinleri engellendi**: Foto Seçici izinsiz çalışıyor; kod `requestMediaLibraryPermissionsAsync` çağırmıyor. Eski `IZIN_METINLERI.md` notu (≤12'de gerekli) bu yüzden geçersiz.
9. **Kamera Tara açılınca**: yeni kabukta Tara doğrudan canlı vizör — "kamera ilk açıldığında" bu an. Kamera sistem penceresi (Tara açılışı) ile AI sheet'i (ilk çekim) farklı anlar; ikisi aynı ekranda art arda gelebilir (SORULAR 5).
10. **Plan adı**: büyük başlıklarda yalnız `sub.paywall.fresh/balance`; "kcalAI" `sub.brand` küçük hap (SubResult) ve küçük üst satır (Profil). Gövde metinleri ("…kcalAI Fresh ile günde…", koç upsell gövdesi) büyük başlık olmadığı için aynı kaldı. "kcalAI Koç" ürün adıdır, plan adı değil — dokunulmadı.
11. Onboarding `OnbNotify` ekranı akışta erişilmiyor (ölü kod); izin istemesin diye "İzin ver" yalnız ilerliyor. Ekran silinmedi (cam testi ona bakıyor).

## HIG kod denetimi (değişen ekranlar)
- Koç ses ret hâli: metin `alert` rolü, satır sınırı yok (Dynamic Type), "Ayarlar'ı aç" 48 pt `button`, Gönder `disabled` + `accessibilityState`. ✓
- Abonelik başarı: "kcalAI" hapı etkileşimsiz (min 32 pt), başlık `header` rolü "Balance etkin"; yeni hareket yok. ✓
- Profil › Abonelik: üst satır 13 pt ikincil ton, büyük ad 24 pt; kırpılma yok. ✓
- Ayarlar › Bildirimler kartı: mevcut FinSecondaryButton (≥ 44 pt); metin sarar. ✓
- eatkcal adres: izin sorulmadıyken uyarı bandı yok (yalnız ret sonrası); "Konumumu kullan" mevcut 44 pt düğme. ✓
- `apple-design-skill` ile ayrı otomatik denetim çalıştırılmadı (zaman); yukarıdaki elle kod denetimi.

## CANLIYA UYGULANACAK
Yok (migration, edge function, bayrak değişikliği yok).

## DEPLOY GEREKİR
- **Yeni native derleme** (iOS + Android): ATT eklentisi/paketi kalktı; Info.plist (ATT anahtarı), `PrivacyInfo.xcprivacy`, Android manifest (`blockedPermissions`) değişti. Mağaza derlemesi İlter onayıyla; OTA yeterli değil.
- ASC App Privacy formu güncellemesi (SORULAR 1) gönderimle aynı anda.

## DERLEME KOMUTU
```
cd ~/dev/kcal-mobile/.claude/worktrees/g23-s1
npx tsc --noEmit && npm run hygiene && npm run test:unit && npx jest
npx expo config --type introspect --json    # ios.infoPlist / android manifest izinleri
npx expo export --platform ios --output-dir /tmp/g26-ios && npx expo export --platform android --output-dir /tmp/g26-android
```

## SORULAR
1. **ASC App Privacy**: "Data Used to Track You" boşaltılsın mı (öneri: evet — Purchase History, Product Interaction, Device ID → izleme Hayır)? Meta'nın AEM kullanımı Apple'ın izleme tanımı dışında kabul ediliyor; hukuk teyidi istenirse L-S1'e.
2. **Meta reklam ölçümü varsayılanı**: ATT olmadığı için iOS'ta artık rıza `unset` iken de olaylar Meta'ya (AEM) gidiyor. KVKK açısından varsayılan kapalı (açık rıza) ister misin? (G20-S1 Ç1 ile aynı soru, artık iOS'u da kapsıyor.)
3. **Sağlık verisi açık rızası** (Takibe başla › Seni tanıyalım) sunucuya ayrı `user_consents` satırı olarak yazılmıyor, yalnız taslak durumu. Kayıt altına alınsın mı? (Migration gerektirir — bu oturumda yapılmadı.)
4. **Bildirim teklifi kaçarsa**: ilk öğün oturumunda başka onay sheet'i açıldıysa teklif atlanıyor ve tekrar gelmiyor. Sonraki oturumda (örn. ikinci öğün kaydı) bir kez daha teklif edilsin mi?
5. **Kamera + AI sırası**: yeni kabukta Tara açılınca kamera sistem penceresi, ilk çekimde AI izni sheet'i geliyor. AI sheet'i kameradan ÖNCE (Tara ilk açılışta) gösterilsin mi, yoksa böyle mi kalsın?
6. **Tek "Tercihler" ekranı** (Tur 26l) tasarım bekliyor — öneri `docs/night/G26-IZINLER.md` §3.
7. **Eski kabuk** (yeni kabuk kapalı) ilk öğün açıklama ekranı yok → otomatik bildirim teklifi yok; yalnız Profil › Bildirim Tercihleri. Kabul mü?
