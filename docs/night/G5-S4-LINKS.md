# G5-S4 — İlter'in yapacakları (derin bağlantı yayına alma)

Kod + landing dosyaları `night5/share-links` dalında hazır. Aşağıdakiler **elle,
panel/DNS üzerinden** yapılacak işler — bu gece YAPILMADI (deploy yok). Sıra önemli.

## 1. Vercel — `l.eatkcal.com` alan adı (landing-page projesi)
- `eatkcal.com` Framer'da; bu yüzden derin bağlantı dosyaları **ayrı** bir alt alan
  adında, **Vercel'deki `landing-page` projesinde** barınacak.
- Vercel → `landing-page` projesi → **Settings → Domains → Add** → `l.eatkcal.com`.
- Vercel bir doğrulama hedefi gösterecek (genelde `cname.vercel-dns.com`).

## 2. Cloudflare DNS — CNAME
- Cloudflare (eatkcal.com zonu) → **DNS → Add record**:
  - Type: `CNAME`, Name: `l`, Target: Vercel'in verdiği hedef (`cname.vercel-dns.com`).
  - **Proxy durumu: DNS only (gri bulut)** — turuncu bulut (proxy) Universal Link/AASA
    getirmeyi bozabilir; kapalı başlat.
- Yayıldıktan sonra doğrula:
  - `https://l.eatkcal.com/.well-known/apple-app-site-association` → **200**, gövde JSON,
    `Content-Type: application/json`, **yönlendirme YOK** (301/302 olmamalı).
  - `https://l.eatkcal.com/.well-known/assetlinks.json` → **200**, JSON.
  - `https://l.eatkcal.com/p/test123` ve `/u/deneme` → önizleme sayfası açılmalı.

## 3. Android — Play App Signing SHA-256 parmak izi
- `landing-page/.well-known/assetlinks.json` içindeki
  `REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FINGERPRINT` **gerçek parmak iziyle** değişecek.
- Kaynak: **Play Console → (uygulama) → Test and release → App integrity →
  App signing → SHA-256 certificate fingerprint**. (`AA:BB:...` formatı, iki nokta
  ayraçlı; JSON'a aynen yapıştır.)
- Not: `com.kcalmobile.app` henüz Play'de yayınlanmadıysa, App Signing anahtarı ilk
  yüklemede/kayıtta oluşur — parmak izi o aşamadan sonra alınır.

## 4. iOS — App Store numarası (önizleme sayfası düğmesi)
- `landing-page/p.html` ve `landing-page/u.html` içinde `APPSTORE_URL = '#'`.
- Uygulama App Store'da yayınlanınca gerçek linkle değiştir:
  `https://apps.apple.com/tr/app/kcalculate/id<APP_STORE_ID>`.
- (Google Play linki `com.kcalmobile.app` ile zaten dolu.)

## 5. Yeni native build şart (OTA YETMEZ)
- `app.config.js`'e eklenen `ios.associatedDomains` ve `android.intentFilters`
  **manifest/entitlement** değişiklikleridir; yalnızca **yeni bir EAS build** ile
  cihaza iner. `eas update` (OTA) bunları taşımaz.
- Sıra: önce (1–2) alan adı + AASA/assetlinks yayında olsun, **sonra** yeni build
  çıkar; aksi halde iOS AASA'yı build anında değil ama ilk kurulumda çeker, domain
  yoksa Universal Link pasif kalır.
- Mevcut 1.0.7 cihazlar etkilenmez (bu özellikler o build'de yok) — kırılma riski yok.

## 6. Bayrağı açma (paylaşım kartı — ayrı, isteğe bağlı)
- Paylaşım kartı `paylasim_karti` bayrağı arkasında, **kapalı**. Açmak için
  `feature_flags` tablosunda SQL (bkz. `docs/night/G4-S2-FLAGS.md`), ör:
  `update public.feature_flags set enabled=true, rollout_percent=100 where key='paylasim_karti';`
- Önce `20261103000500_feature_flags.sql` + `20261103020000_paylasim_karti_flag.sql`
  migration'ları uygulanmış olmalı (ikisi de henüz canlıya gitmedi).

## SORULAR (karar bekleyen)
1. **Alt alan adı `l.eatkcal.com` onaylanıyor mu?** (Görevdeki öneri buydu.) Başka bir
   ad istenirse `app.config.js` (associatedDomains + intentFilters) ve
   `src/navigation/linking.ts` prefix'leri + bu dosya güncellenmeli.
2. **Android imza parmak izi** nereden? (Play App Signing mı, yoksa upload key mi —
   App Links için **App Signing** sertifikası doğru olan.)
3. Önizleme sayfalarında şimdilik **gerçek içerik yok** (gönderi/profil sosyal katmanı
   kurulmadı). İçerik API'si gelince `p.html`/`u.html` dinamik hale getirilmeli mi,
   yoksa statik "uygulamada aç" yönlendirmesi yeterli mi?
