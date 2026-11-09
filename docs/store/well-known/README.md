# l.eatkcal.com — derin bağlantı dosyaları (G20-S2)

Bu klasördeki iki dosya **web'e konacak** (bu gece deploy YOK). Hedef: Vercel `landing-page`
projesi, `l.eatkcal.com` alan adı → `landing-page/.well-known/` altındaki mevcut dosyaların
**yerine**. Uygulama tarafı `app.config.js` (iOS `associatedDomains`, Android `intentFilters`)
ve `src/navigation/linking.ts` + `src/lib/metrics/attribution.ts` ile eşleşir.

| Dosya | Web yolu | Değişen |
|---|---|---|
| `apple-app-site-association` | `https://l.eatkcal.com/.well-known/apple-app-site-association` | `/k/*`, `/s/*`, `/kesfet` eklendi (önce yalnız `/p/*`, `/u/*`) |
| `assetlinks.json` | `https://l.eatkcal.com/.well-known/assetlinks.json` | İkinci parmak izi yeri (EAS yükleme anahtarı — iç test APK'ları için) |

## Yollar ve uygulamadaki karşılığı
| Yol | Uygulama ne yapar | Kaynak |
|---|---|---|
| `/p/<post_id>` | Paylaşılan gönderi (SharedPost) + kaynak `share/post` | `linking.ts` `p/:postId`, `attribution.ts` |
| `/u/<handle>` | Herkese açık profil (PublicProfile) + kaynak `share/profile` | `linking.ts` `u/:handle` |
| `/kesfet` | Keşfet (yalnız `kesfet` bayrağı açıkken kayıtlı; kapalıysa normal açılış) | `linking.ts` `kesfet` |
| `/k/<kod>` | Normal açılış (rota yok) + kaynak `box_card/qr`, kod büyük harf | `attribution.ts` |
| `/s/<kod>` | Normal açılış (rota yok) + kaynak `saha/field` | `attribution.ts` |
| diğer (`/privacy`, `/terms`, `/account-deletion`, `/`) | Uygulamayı AÇMAZ — tarayıcıda kalır | AASA'da yok; Android önekleri `/x/` biçiminde |

**Düzeltme (G20-S2):** Android'de önceki `pathPrefix: '/p'` öneki `/privacy` sayfasını da
yakalıyordu (App Links doğrulanınca gizlilik sayfası uygulamayı açacaktı). Önekler artık
`/p/`, `/u/`, `/k/`, `/s/`; `/kesfet` tam yol (`path`).

## Yayına alma sırası
1. Bu iki dosyayı `landing-page/.well-known/` altına kopyala (aynı ad, uzantısız AASA).
2. `assetlinks.json` parmak izleri:
   - **Play App Signing** SHA-256: Play Console › Test and release › App integrity › App signing.
   - **EAS yükleme anahtarı** SHA-256 (iç test/preview APK'ları doğrudan EAS imzasıyla kurulur):
     `eas credentials -p android` › production keystore › SHA256 Fingerprint. Gerek yoksa satırı sil.
   - Biçim `AA:BB:…` (iki nokta ayraçlı, büyük harf).
3. Web dönüş sayfaları — uygulama kurulu DEĞİLSE bağlantı web'de açılır. Bugün `vercel.json`
   yalnız `/p/:postId` ve `/u/:handle` için sayfa yazıyor; `/k/*`, `/s/*`, `/kesfet` **404** verir.
   Önerilen ek (landing-page `vercel.json` › `rewrites`), kodu sorgu parametresiyle koruyan
   tek bir "uygulamayı indir" sayfası:
   ```json
   { "source": "/k/:code", "destination": "/index.html" },
   { "source": "/s/:code", "destination": "/index.html" },
   { "source": "/kesfet",  "destination": "/index.html" }
   ```
   (Mağaza bağlantılarında kampanya ölçümü istenirse App Store `ct=`/`pt=` ve Play
   `referrer=utm_source%3Dbox_card…` parametreleri bu sayfada eklenir — kurulum öncesi
   kod uygulamaya taşınmaz; uygulama yalnız bağlantıyla açılışta kodu okur.)
4. Doğrulama (yönlendirme OLMAMALI, 200 + `application/json`):
   ```sh
   curl -sI https://l.eatkcal.com/.well-known/apple-app-site-association
   curl -s  https://l.eatkcal.com/.well-known/apple-app-site-association | python3 -m json.tool
   curl -s  https://l.eatkcal.com/.well-known/assetlinks.json | python3 -m json.tool
   # Apple CDN (iOS bunu okur; değişiklik 24–48 saatte yansıyabilir):
   curl -s  https://app-site-association.cdn-apple.com/a/v1/l.eatkcal.com
   # Google doğrulayıcı:
   curl -s "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://l.eatkcal.com&relation=delegate_permission/common.handle_all_urls"
   ```
5. Yeni native derleme (1.1.0) — `associatedDomains`/`intentFilters` OTA ile gitmez.
6. Cihaz testi: `YAYIN_KONTROL.md` › "Derin bağlantı" adımları
   (Android: `adb shell pm get-app-links com.kcalmobile.app` → `l.eatkcal.com: verified`).

## Notlar
- Cloudflare: `l` CNAME **DNS only** (gri bulut) — proxy AASA'yı bozabilir (G5-S4-LINKS.md).
- `webcredentials` (parola otomatik doldurma) korunur; uygulama parola kullanmıyor, zararsız.
- iOS AASA yol eşlemesi büyük/küçük harfe duyarlı: QR kodlarında `/k/` ve `/s/` küçük harf
  basılmalı (kodun kendisi uygulamada büyük harfe çevrilir).
