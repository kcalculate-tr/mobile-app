# G41-S1 — Yayın build'i: Meta onayı + ATT, R8, seçenek görseli (13 Kas)

Dal `release/1.1.0` · worktree `.claude/worktrees/g23-s1` · NATIVE build içerir: sürüm 1.1.0, runtime 1.1.0, iOS build 32, Android versionCode 11.
Tek yeni paket: `expo-tracking-transparency@~6.0.8` (madde 1; eklentisi kullanılmadı).
Yapılmayanlar: deploy / `eas build` / `eas submit` / OTA / canlı DB yazma / migration uygulama.

## ÖZET
1. **md.1 ATT yalnız onay verene.**
   - `NSUserTrackingUsageDescription` Info.plist'te. TR: "Kampanya ve reklam ölçümü için, yalnız kayıtta izin verdiysen kullanılır." EN metni `locales/en.json`'da.
   - Sistem sorusu açılışta HİÇ sorulmaz. Yalnız Meta kutusu işaretlenince hemen ve bir kez sorulur (`src/lib/att.ts` › `requestAttOnce`). Durum belliyse pencere açılmaz.
   - ATT reddedilirse kutu "verilmedi" kalır. Meta'ya IDFA ve olay gitmez: iOS'ta `metaAllowed` ve `fbSettingsFor` onay + ATT izni arar.
2. **md.2 Meta onayı kayıtta, isteğe bağlı kutu.**
   - Kayıt/giriş ekranında zorunlu kutunun altına İŞARETSİZ `MetaConsentRow` eklendi. Kayıt kutusuz da tamamlanır.
   - Eski "Reklam ölçümü kapalı · Ayrıntılar" satırı ve ayrıntı sheet'i kalktı.
   - "Veri ve reklam izinleri" sayfasındaki Meta anahtarı kaldırıldı.
   - Profil › Gizlilik'e tek satır geldi: "Meta reklam ölçümü" + "Açık/Kapalı".
     - Kapatmak geri çekmedir.
     - Açmak iOS'ta ATT ister. ATT reddedilmişse satır kapalı kalır, iPhone Ayarlar yolu ve "Ayarları aç" bağlantısı gösterilir.
   - Saklama mevcut yapıyla: `@kcal_consent_ads` + `user_consents`. Kind/source 'att' satırları G20'den beri CHECK'te var. Yeni tablo ve migration yok.
   - Mevcut kullanıcı: önceki anahtar açıksa onay açık sayılır. iOS'ta ATT sonucu yoksa bir sonraki açılışta TEK SEFER `att_notice` kartı çıkar, "Devam" → ATT. Reddederse onay "verilmedi" olur (source 'att').
3. **md.3 Bildirim ön kartı.**
   - İlk öğün kutlamasından sonra "Öğün saatinde hatırlatayım mı?" kartı çıkar (TR/EN).
   - "Evet" → sistem penceresi (tek fonksiyon `requestPushPermission`).
   - "Şimdi değil" ya da kaydırıp kapatma → pencere açılmaz. 7 gün sonra bir öğün kaydında EN FAZLA bir kez daha gösterilir (`decideNotifyReoffer`).
4. **md.4 Seçenek görseli.**
   - Kök neden iki parçalı:
     - Kod, seçeneğin `image_url` çıkartmasını bağlı ürün fotoğrafının önüne koyuyordu.
     - G35 gramaj LIKE'ı (`'Izgara Köfte %'`) ürün adlı seçeneklere köfte çıkartması yazıyor: "Izgara Köfte Basmati ve Brokoli Sebze" 7 satır, "Izgara Köfte Bowl" 9 satır.
   - Yeni kural (`groupOptionImageCandidates`):
     - Bağlı ürünün ya da adı eşleşen ürünün fotoğrafı ÖNCE.
     - Protein/şarküteri çıkartması YALNIZ gramaj grubunda: `gramaj_options`, başlığında "gramaj" geçen grup, ya da bütün seçenekleri "50g / 3 Yumurta" gibi çeşit olan grup/şablon.
   - Simülatörde id 33 ve 43'ün bütün ana öğün kartları kendi ürün fotoğrafını gösteriyor.
   - Veri migration DOSYASI + rollback hazır. Denetim belgesi: `docs/night/G41-SECENEK-DENETIMI.md`.
5. **md.5 Android R8.**
   - Yerel config plugin `withAndroidR8` (`app.config.js`) iki şey yapar: `withGradleProperties` + `proguard-rules.pro` keep kuralları. Kuralı olan kütüphanelere kural eklenmedi.
   - **Önemli bulgu:** SDK 54 şablonu `android.enableMinifyInReleaseBuilds` okuyor. Görevdeki `android.enableProguardInReleaseBuilds` tek başına R8'i AÇMAZDI. İkisi de yazılıyor.
   - Mapping: R8 `mapping.txt` AAB içine giriyor (Play otomatik kullanır). Sentry AGP de açık (yalnız mapping yüklemesi).
6. **md.6** iOS `buildNumber` 32, Android `versionCode` 11. EAS `appVersionSource: remote` + production `autoIncrement` → aşağıdaki SORULAR 1.
7. **md.7** İnceleme notu PRIVACY bölümü (EN form metni + TR özet) güncellendi. Ayrıca `GIZLILIK_BEYANLARI.md` G41 bölümü (App Privacy "Data Used to Track You" geri geliyor) ve `IZIN_METINLERI.md` ATT satırı.
8. **md.8 Kontroller** (son hâl, commit 62989a9):

| Kontrol | Sonuç |
|---|---|
| hygiene + tsc | ✓ |
| unit (`tsx --test`) | 1292/1292 ✓ |
| jest | 109 suite / 661 test ✓ |
| `expo export` iOS / Android | ✓ / ✓ |
| `expo prebuild --clean` | ✓ — geçici kopyada (`$CLAUDE_JOB_DIR/tmp/pb1`, worktree'nin android/ios'una dokunulmadı), `--no-install`. Disk 12 GB boş, yetti (pod/gradle derlemesi yapılmadı) |
| Bileşen testleri (istenenler) | Meta kutusu işaretsiz varsayılan · ATT yalnız kutudan sonra ve bir kez · ATT reddi → kutu boş · Meta olayı onaysız/ATT'siz gönderilmez · bildirim ön kartı (Evet / Şimdi değil / 7 gün) · linked_product görseli (Light/Dark) · modülsüz derlemede ATT güvenli |

Prebuild çıktısında doğrulananlar:

| Dosya | Görülen |
|---|---|
| `Info.plist` | `CFBundleVersion` 32, `NSUserTrackingUsageDescription` TR |
| `en.lproj/InfoPlist.strings` | EN metin |
| `PrivacyInfo.xcprivacy` | `NSPrivacyTracking` true + `ep1.facebook.com` |
| `android/app/build.gradle` | `versionCode` 11 |
| `gradle.properties` | `enableMinifyInReleaseBuilds` / `enableProguardInReleaseBuilds` / `enableShrinkResourcesInReleaseBuilds` = true |
| `proguard-rules.pro` | G41 bloğu var |
| Sentry AGP | `classpath` + `sentry {}` var (prebuild `SENTRY_ORG`/`SENTRY_PROJECT` deneme değerleriyle çalıştırıldı) |
| `AndroidManifest.xml` | yeni `AD_ID` izni YOK (eklenti kullanılmadı) |

## Commit'ler
| Commit | Konu |
|---|---|
| 0338fa6 | md.1+2 Meta kutusu + ATT akışı, Gizlilik satırı, izinler sayfası anahtarı kalktı, tek seferlik kart, gizlilik manifesti; app.config R8 plugin + sürüm numaraları; testler |
| 641ab54 | md.3 bildirim ön kartı + 7 gün kuralı; testler |
| 45f3f45 | md.4 seçenek görseli kuralı, migration DOSYASI + rollback, denetim belgesi; testler |
| a769796 | md.5 `enableMinifyInReleaseBuilds` düzeltmesi, md.6 sürüm testi, md.7 inceleme notu + gizlilik/izin belgeleri |
| 62989a9 | ATT modül varlık denetimi (OTA/eski derleme güvenliği) + test; vitrin `G41-*`; ekran görüntüleri `docs/night/g41/` |
| (bu) | docs: G41-S1 LOG |
| (son) | docs/night/G41-S1-DONE |

53 dosya, +1746 / −240 (LOG hariç).

## KARAR
1. **`expo-tracking-transparency` eklentisi eklenmedi.** Eklenti Android manifestine `com.google.android.gms.permission.AD_ID` ekliyor. Bunun yerine metin `ios.infoPlist` + `locales/*.json`'da. Yerel modül autolinking ile derlemeye girer.
2. **ATT modülü tembel ve korumalı yükleniyor.** `requireOptionalNativeModule('ExpoTrackingTransparency')` yoksa paket hiç yüklenmez. Simülatördeki eski dev build'de (modülsüz) Metro, try/catch'e rağmen LogBox hatası gösterdi; bu korumayla giderildi. Aynı koruma, bu modülü içermeyen eski bir 1.1.0 derlemesine OTA giderse çökmeyi önler.
3. **Gizlilik manifesti.**
   - `NSPrivacyTracking: true` + `NSPrivacyTrackingDomains: ['ep1.facebook.com']` (G26 öncesi çalışan yapı).
   - `Tracking: true`: Device ID (IDFA; ThirdPartyAdvertising + Analytics), Product Interaction, Purchase History.
   - Sebep: ATT gösterip "izleme yok" beyan etmek Apple 5.1.2 reddi riskidir.
4. **Gizlilik satırı.** Satır "Meta reklam ölçümü" başlığı + "Açık/Kapalı" alt satırı + Switch'ten oluşuyor (HIG: aç/kapa için anahtar). Değer, etkin durumu gösterir: onay + iOS'ta ATT. Eski kullanıcıda ATT sorulmadıysa "Kapalı" görünür. Bölüm etiketi "Reklam".
5. **Tek seferlik kart kapatılamıyor.** Tek düğme "Devam" her zaman sistem sorusuna gider (Apple ön-izin kuralı: "izin verme" alternatifiyle sistem sorusunu atlatmak yok). Kart gösterildiği AN işaretlenir.
6. **Kayıt ekranında ATT.** Kutu işaretlenince ATT kayıt tamamlanmadan sorulur ("kutu işaretlendikten hemen sonra"). Sonuç `user_consents`'e 'att' satırı olarak yazılır (oturum yoksa kuyrukta bekler, girişte yazılır).
7. **Gramaj grubu tespiti.** Yalnız başlıktaki "gramaj" yetmezdi: tera/breaking_fast'te "Fıstıklı Mortadella Salam Seçimi" → "Mortadella 50g" gibi gruplar çıkartmasını kaybederdi. Kural: başlıkta "gramaj" ya da bütün seçenekler gramaj/adet çeşidi.
8. **Canlı DB okuması reddedildi.** Supabase MCP salt okunur `execute_sql` bu oturumda izin sınıflandırıcısınca reddedildi ("Production Reads"). Engel aşılmaya çalışılmadı. Denetim statik yapıldı: G35 eşleme işlevi taklit edildi, G38 canlı ad listesi kullanıldı. Simülatördeki paket sayfaları, uygulamanın kendi herkese açık menü okumasıyla çekildi (G40 ile aynı yol).
9. **Ekran görüntüleri.** Mevcut "G40 iPhone" simülatörü kullanıldı (9 Kas 1.1.0 dev build; native derleme yapılmadı, disk < 20 GB). Metro bu worktree'den port 8140'ta çalıştı.

## HIG (kod denetimi — değişen ekranlar)
- **Dokunma alanı:** Meta kutusu satırı `minHeight 44` (kutu 22 pt, bütün satır basılır). Gizlilik satırı 64 pt + Switch. "Ayarları aç" bağlantısı 44 pt + hitSlop. Ön kart düğmeleri 52 pt.
- **VoiceOver:**
  - Meta kutusu: `checkbox` + checked/busy, etiket = metin, ipucu "İsteğe bağlı …".
  - Gizlilik anahtarı: etiket + `accessibilityValue` "Açık/Kapalı".
  - ATT reddi notu ve Ayarlar notu: `accessibilityLiveRegion="polite"`.
- **Dynamic Type:** metinler `AppText` / `FinText` ile, satırlar esnek yükseklikte (kırpılma yok).
- **Kontrast:** kutu çerçevesi Onb `line2`, işaretli hâl mürekkep zemin + `onInk` tik. Light/Dark görüntülerde okunur (`docs/night/g41/Account*.jpg`).
- **Hareket:** yeni animasyon yok (sheet'ler mevcut token'larla).
- `apple-design-skill` ayrıca çalıştırılmadı (yukarıdaki denetim elle yapıldı).

## Ekran görüntüleri (`docs/night/g41/`)
| Dosya | İçerik |
|---|---|
| `Account.jpg` / `Account-Dark.jpg` | Kayıt ekranı: zorunlu kutunun altında İŞARETSİZ Meta kutusu |
| `Privacy.jpg` / `Privacy-Dark.jpg` | Profil › Gizlilik: "Reklam" › "Meta reklam ölçümü · Kapalı" |
| `Notify.jpg` / `Notify-Dark.jpg` | "Öğün saatinde hatırlatayım mı?" · Evet / Şimdi değil |
| `Package.jpg` / `Package-Dark.jpg` | id 33 "Ana Yemek + Detoks/Shake Paketi": ana öğün kartları ürün fotoğrafı |
| `Package2.jpg` | id 43 "2 Kişilik …": 1. ve 2. Ana Öğün Seçimi, ürün fotoğrafları |

## CANLIYA UYGULANACAK (İlter, zaman sırasıyla)
1. Önceki bekleyenler: `20261112120100_g35_option_images`, sonra `20261112140100_g38_urun_adlari` (ve G38 sosları). **Sıra önemli:** G38, G35'ten önce uygulanırsa gramaj adları G35 eşlemesinden düşer. G41 dosyası boş kalanları doldurur, yine de sırayla uygulayın.
2. **`20261113100100_g41_option_image_fix.sql`** (rollback: `supabase/rollbacks/20261113100100_g41_option_image_fix_rollback.sql`). Yaptıkları:
   - bağlı ürünlü seçeneklerdeki protein çıkartmasını NULL yapar;
   - G38 kısa adlı gramaj/baz satırlarını doldurur;
   - yedeği `_g41_option_image_backup` tablosuna alır (RLS açık, politika yok).

   Uygulama kodu kuralı zaten uyguladığı için zorunlu değil; panel/web ve tutarlılık için önerilir. Sonrasında `docs/night/G41-SECENEK-DENETIMI.md` "Canlı tarama sorguları" çalıştırılmalı.
3. CLAUDE.md kuralı: backend commit'i (bu turda yalnız `supabase/migrations` + `supabase/rollbacks` dosyaları, 45f3f45) main'e cherry-pick edilmeli. Bu oturumda main'e dokunulmadı.

## DEPLOY GEREKİR — İlter'in çalıştıracağı build komutu
```
eas build --profile production --platform all
```
- Native değişiklik var (yeni yerel modül `ExpoTrackingTransparency`, Info.plist, gizlilik manifesti, R8). Bu sürüm OTA ile gidemez.
- Sonra mağaza gönderimi (onaysız yasak; İlter):

```
eas submit --profile production --platform ios
eas submit --profile production --platform android
```
- Göndermeden önce **App Store Connect › App Privacy** güncellenmeli: "Data Used to Track You" = Device ID, Product Interaction, Purchase History. Ayrıntı `GIZLILIK_BEYANLARI.md` › G41.

## SORULAR
1. **Sürüm numarası (md.6):** `eas.json` `appVersionSource: "remote"` + production `autoIncrement: true`. `app.config.js`'teki `buildNumber: '32'` / `versionCode: 11` EAS derlemesinde KULLANILMAZ; EAS uzak sayacı bir artırır. iOS 32 / Android 11 çıksın istiyorsanız build'den önce panelden ya da `eas build:version:set` ile uzak değeri iOS 31 / Android 10'a ayarlayın (autoIncrement +1 yapar). Kontrol: `eas build:version:get`.
2. **Sentry mapping yüklemesi:** Sentry Android Gradle Plugin 5.11.0 yalnız `SENTRY_ORG` + `SENTRY_PROJECT` EAS ortamında tanımlıyken eklenir. Mapping yüklemesi `SENTRY_AUTH_TOKEN` ister. Token yoksa yükleme görevi build'i düşürebilir; acil durumda EAS env'e `SENTRY_DISABLE_AUTO_UPLOAD=true` ekleyin. Play için mapping zaten AAB içinde.
3. **R8 sonrası duman testi:** gerçek release derlemesi bu oturumda alınamadı (gradle derlemesi yok). Production AAB'yi internal track'te açıp şunları deneyin: RevenueCat paywall, Meta kutusu, Sentry test hatası, Google/Apple girişi, harita, video. Keep kuralları `app.config.js` › `R8_RULES`.
4. **Detoks/shake seçeneklerinin bağlı ürünü:** G38 kısa adlarından sonra (ör. "Yeşil Canlandırıcı", "Fıstık Ezmeli Shake") `linked_product_id` boşsa görsel ada göre bulunamaz. Simülatörde şişe görselleri görünüyor (bağlı görünüyor), ama canlıda denetim belgesindeki "sorgu 2" ile doğrulanmalı.
5. **"Veri ve reklam izinleri" sayfa adı:** Meta anahtarı bu sayfadan kalktı, adı aynen bırakıldı ("reklam" artık yalnız Gizlilik satırında). Sayfa adı "Veri izinleri" olsun mu?
6. **Kayıt sırasında ATT:** kullanıcı Meta kutusunu işaretleyip ATT'ye izin verir ama kaydı tamamlamazsa, cihazda ATT "izinli" kalır. Rıza ancak kayıt/giriş tamamlanınca 'granted' yazılır, yani Meta yine kapalıdır. Beklenen davranış bu mu?
7. "G40 iPhone" simülatörü açık bırakıldı (`D2B68EDD-…`). Silmek için `xcrun simctl delete D2B68EDD-D6A9-4059-98B8-232F5CF8A804`.
