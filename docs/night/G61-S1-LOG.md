# G61-S1 — Paylaşım paketi (Instagram / WhatsApp / bağlantı) (18 Kas)

Dal `release/1.1.0` · worktree `.claude/worktrees/g23-s1` · başlangıç `6f9de8c`. Yalnız JS/TS + migration DOSYASI + `landing-page/` dosyaları. Yeni paket YOK. Deploy / OTA / canlı DB yazma / migration uygulama / bayrak açma YOK. `app.config.js` sürüm/runtime satırlarına dokunulmadı (yalnız Android intentFilters'a 5 yol eklendi → bir sonraki mağaza derlemesinde etkin, OTA'yı etkilemez).

> Not: Aynı worktree'de eşzamanlı başka bir oturum `release/1.1.0`'a commit atıyordu (`d4ec390`, `3e7d571`, `7872de6` …). Onun dosyalarına dokunulmadı; her commit'e yalnız bu oturumun dosyaları eklendi.

## ÖZET
1. **md.1 Kart üretimi (paketsiz):** `src/lib/qr.ts` saf TS QR üretici (bayt kipi UTF-8, sürüm 1–10, L/M/Q/H, ISO maske cezası) — bağımsız bir uygulamanın (Kazuhiko Arase QRCode) altın matrisleriyle modül modül aynı (168/168 karşılaştırma + test). 8 kart tek bileşen `ShareCard` (react-native-svg; `bg` light/dark/photo × `size` story 1080×1920 / post 1080×1350 × `qr`), tasarım ölçüleri/renkleri/TR-EN metinleri birebir. Tabak Röntgeni kartı eski `PlateXRayShareModal`'ın yerine (iki bayrak açıkken).
2. **Gizlilik:** `cardModel.ts` kart başına beyaz liste (FinShareNotes "Gösterdiği veri") + `sanitizeCard` + yasak alan desenleri (kilo, hedef, gün toplamı, sağlık, konum, abonelik, sayaçlar…); sunucu da aynı listeyle süzer (`share_payload_clean`). Gün kartında yalnız yüzde.
3. **md.2 Paylaş sayfası:** `ShareSheet` — Hikâye 9:16 / Gönderi 4:5, 3 şablon (gerçek kartın küçültülmüşü; foto yoksa 2), QR anahtarı, gizlilik satırı, hedefler; hâller varsayılan / kopyalandı (2,4 sn) / hazırlanıyor (iskelet, görsel hedefleri pasif) / hata (Tekrar dene; bağlantı + Diğer açık). Şablon + ölçü kart türü başına hatırlanır. Analitik `share_open`, `share_target` (tür, hedef, ölçü, zemin, ok).
4. **md.3 Bağlantılar:** `/p /u /r /i /m /d /x /s` + `utm_source=<hedef>` (`links.ts`). Uygulama içi `ShareLink` rotası (`m|d|x|r|i/<id>`, `s/<UUID>`); `/i/<kod>` kodu cihaza kaydeder → sepette "Davet kodun var mı?" açık + dolu gelir. Migration DOSYASI `share_snapshots` + `create/get/revoke_share_snapshot` + anon `get_share_preview`.
5. **md.4 Web:** barındırma bulundu → `landing-page/` (Vercel, l.eatkcal.com, AASA zaten orada). `landing-page/api/share.js` sunucu işlevi: FinShareLanding (8 tür, açık/koyu, TR/EN) + og:* (başlık ≤ 60, açıklama ≤ 110, `summary_large_image`), gizli/silinmiş → "Bu içerik artık yok" (404). OG görselleri FinShareOG düzeninde tür × dil statik 1200×630 (18 PNG). Supabase edge function gerekmedi.
6. **md.5 Giriş noktaları:** gönderi menüsü "Paylaş" (+ kart/ayrıntı paylaş düğmesi), profil başlığı paylaş simgesi, öğün detayı (Tracker), gün kartı "Günü paylaş" (Ana sayfa halka bloğu), davet "Kodunu paylaş", hikâye görenler "Paylaş" → hepsi `ShareSheet` (`useShareSheet`).
7. **Bayrak kapalı = bugünkü davranış** (eski ShareMealCard / PlateXRay modalları, Share.share, düğme yok) — jest + kaynak denetimiyle sabit.
8. **Cihazda doğrulama:** 48 kart GERÇEK `toDataURL` hattıyla simülatörde PNG'ye çevrildi; **fotoğraflı zemin toDataURL'de görünüyor** (gizlemeye gerek kalmadı). Bulunan 2 hata düzeltildi (çıktı 3× = 3240 px'ti → tam 1080 px; hikâye bağlantı çipi taşması).
9. **Kontroller (son kod, aşağıdaki tablo):** hygiene + tsc · unit · jest · expo export iOS + Android.
10. Ekran görüntüleri `docs/night/g61/` (48 kart, 13 sayfa hâli, 10 web açılış, 5 OG).

## Commit
| Commit | İçerik |
|---|---|
| `896456b` | md.1 QR üretici + altın test, bağlantı biçimleri, gizlilik kart modeli, 8 SVG kart, attribution (m/d/x/r/i/s-UUID) |
| `92b2b55` | md.2 ShareSheet, hedef yönlendirme, `share_open`/`share_target`, `SHEET.share` + `SHARE_MOTION`, i18n `g61.ts` |
| `b9b09d9` | md.3 migration + rollback, `snapshotApi`, linking + `ShareLink` ekranı, bekleyen davet kodu, testler |
| `2539838` | md.5 6 giriş noktası, `useShareSheet`, jest (sayfa hâlleri / hedefler / bayrak kapalı / ShareLink), hedef birim testleri |
| `9dbdf9a` | md.4 `landing-page/api/share.js`, `vercel.json`, AASA, Android intentFilters, OG görselleri, web testi |
| `2ab7550` | ortak klavye özelliği (şablon kaydırması), Keşfet bağlantı koşulları eski ifadeye döndü (g25 testi) |
| `deed3af` | simülatör düzeltmeleri (1080 px yakalama, hikâye çipi) + vitrin + ekran görüntüleri |
| (LOG) | bu dosya |
| (son) | `docs/night/G61-S1-DONE` |

## Kontroller (son kod)
Kod hâli `deed3af` (LOG/DONE yalnız belge):
| Kontrol | Sonuç |
|---|---|
| hygiene + tsc (`npm run typecheck`) | geçti (2788 takipli dosya) |
| unit (`npm run test:unit`) | 1589 / 1589 |
| jest (`npm run test:components`) | 139 / 139 suite, 977 / 977 test |
| `expo export --platform ios` | geçti (3532 modül) |
| `expo export --platform android` | geçti (3539 modül) |

Yeni testler: `qr.test.ts` (altın matris, BCH, desenler, maske), `g61Share.test.ts` (bağlantı biçimleri, utm, attribution, gizlilik), `g61Targets.test.ts`, `g61Migration.test.ts`, `g61Web.test.ts`, `g61ShareLinks.test.ts` (getStateFromPath), jest `g61ShareSheet.test.tsx` (hâller, hedefler, bayrak kapalı = eski), `g61ShareLink.test.tsx`.

## KARAR
- **Yeni sayfa YALNIZ `paylasim_karti` + `paylasim_baglanti` ikisi de açıkken.** `paylasim_karti` G5'ten beri var ve canlı durumu bu oturumda okunamadı (Supabase MCP okuması izin katmanında reddedildi). Yalnız `karti`'ye bağlasaydım ve canlıda açıksa, OTA ile eski öğün/röntgen modalları kendiliğinden yeni sayfaya dönerdi (= bayrak açma). Böylece: karti açık + bağlantı kapalı → eski modallar AYNEN; bağlantı açık + karti kapalı → bugünkü Share.share; ikisi açık → yeni sayfa. "Bağlantısız kart" kipi (`linkEnabled=false`) bileşende duruyor ve test ediliyor, ama bu sürümde hiçbir giriş onu açmıyor. → SORU 1.
- **Instagram:** galeriye kaydetme `expo-media-library` ister (pakette YOK, yeni paket yasak). Bu sürümde: bağlantı panoya kopyalanır → kart görseli (Hikâye 9:16 / Gönderi 4:5) sistem paylaşım sayfasıyla açılır, kullanıcı Instagram'ı seçer (iOS Instagram uzantısı Akış/Hikâye sunar). `instagram://` açma yalnız görselsiz olacağı için yapılmadı. **Kaydet** hedefi gizli (aynı neden); sistem sayfasındaki "Görüntüyü Kaydet" kullanılabilir.
- **WhatsApp / X:** `whatsapp://send?text=` ve `x.com/intent/post` doğrudan `Linking.openURL` (iOS `LSApplicationQueriesSchemes` yok → `canOpenURL` kullanılmadı; açılamazsa sistem paylaşımına düşer).
- **`/s/` çakışması:** `/s/<kod>` G20'den beri saha kodu. Hikâye kimliği UUID → `/s/<UUID>` = hikâye, diğerleri saha (uygulama, attribution, Vercel yönlendirmesi üçü de bu kuralla). Saha bağlantılarının bugünkü davranışı değişmedi.
- **QR içeriği:** `utm_source` olmadan çıplak bağlantı (kart, hedef seçilmeden önce çizilir; 6 hedef listesinde "qr" yok).
- **Anlık görüntü (öğün/gün/röntgen):** foto yolu yüke girmez (yerel dosya + gizlilik); web önizlemesi tür görseli kullanır. Sunucuda günde ≤ 100 anlık görüntü / kullanıcı. Kimlik 10 karakter, `gen_random_bytes`.
- **Kart çizimi farkları (SVG sınırları):** CSS `filter: blur` lekeler → radyal gradyan; gölgeler yok; profil/röntgen fotoğraflı zemininde bulanık foto yerine %45 koyu örtü; öğün kartında tasarımdaki dekupe "çıkartma" yerine daire içinde öğün fotoğrafı (fotoğraf yoksa cam kase — "kase = öğün" kuralı). Metin genişliği karakter sınıfı tablosuyla tahmin (`textFit.ts`).
- **Hikâye kartı fotoğraflı kipte** bağlantı çipi alt bilgiyle çakışmasın diye logonun üstüne alındı (tasarımda çakışıyordu).
- **Paylaş sayfası hareketi:** mevcut `Sheet` bileşeni + yeni `SHEET.share` (500 ms enter) ve `SHARE_MOTION` token'ları (seçim 220, bildirim 330 + 2,4 sn, basış ×0,96). Azaltılmış harekette Sheet 220 ms opaklık, basış ölçeği yok. Cam yerine düz `surface` (Reduce Transparency karşılığı her zaman).
- **Gün kartı:** adım verisi uygulamada yok → kartta adım hücresi yalnız veri gelirse (vitrin örneğinde var, canlıda gösterilmez). Su yalnız su takibi verisi varsa.
- **Tarif `/r/<tarif>`:** uygulamada tarif ayrıntı rotası yok → ShareLink ekranı tarif kartını gösterir. Tarif paylaş giriş noktası brief'te yok, eklenmedi (kart + web hazır).
- **Tabak Röntgeni girişi** yalnız eski kabuk sonuç ekranında vardı; yeni kabuk `FinPhotoResult`'a paylaş düğmesi eklenmedi (brief'in 6 girişinde yok).
- **Web OG:** sunucuda SVG→PNG paket ister → tür başına statik görsel (`/og/<tür>-<dil>.png`, koyu). Dinamik başlık/açıklama og meta'da.
- **`share_open` / `share_target`** sözlüğe + migration olay satırlarına eklendi; eski KPI `share` olayı da başarılı paylaşımda sürüyor.

## HIG / erişilebilirlik (kod denetimi + simülatör)
- Dokunma ≥ 44 pt: hedefler 84×84, ölçü sekmeleri 34 + 4/4 hitSlop (≥ 42 → tasarımla aynı; satır 40), şablonlar 150 geniş, QR satırı 48, kapat 44, Tekrar dene 44, profil paylaş 40 + 8 hitSlop, "Günü paylaş" 44.
- VoiceOver: ölçü ve şablon `radiogroup`/`radio` + `checked`; şablon etiketi "Açık, Hikâye 9:16"; hedefler `button` + `disabled`/`busy`; QR `Switch` etiketli; bildirim `alert` + `announceForAccessibility`; iskelet `progressbar` "Görsel hazırlanıyor"; gizli yakalama kartları ekran okuyucudan gizli; ShareLink kartı etiketli.
- Dynamic Type: sayfa `scroll`; hedef etiketleri 2 satıra kadar; kart içi metin bilerek görsel kompozisyon (paylaşılan görüntü).
- Reduce Motion: yukarıda. Kontrast: tasarım renkleri (açık #6B6B70 ikincil, koyu #A1A1A6).
- `apple-design-skill` ayrıca çalıştırılmadı; denetim yukarıdaki maddelerle elle + simülatörde.

## CANLIYA UYGULANACAK migration (önce dal DB'de `supabase db push --dry-run`)
1. `supabase/migrations/20261118100100_g61_share.sql` — rollback `supabase/rollbacks/20261118100100_g61_share_rollback.sql`.
   - Önkoşul: `pgcrypto` (`extensions.gen_random_bytes`), G5 `profiles.handle/bio/is_private`, G5 `posts/post_media`, G33 `recipes/recipe_ingredients/ingredient_nutrition`; varsa G59 `stories`, G56 `referral_codes`, G19 `analytics_event_names` (yoksa ilgili kısım atlanır).
   - Yerel Postgres yok → SQL çalıştırılarak denenmedi; birim testi metni denetliyor (RLS, izinler, beyaz liste = istemci listesi, gone kuralları, `$$` dengesi).
- CLAUDE.md gereği backend commit'i main'e cherry-pick edilmeli (bu oturumda main yasak): `b9b09d9` (migration + rollback; aynı commit'te istemci dosyaları da var → yalnız `supabase/` dosyalarını alın).

## DEPLOY GEREKİR (onayınızla)
- **Vercel `landing-page`:** `api/share.js` + `vercel.json` + `.well-known/apple-app-site-association` + `og/`. Proje ortam değişkenleri: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (yayımlanabilir anon anahtar). Yoksa sayfa türün genel önizlemesine düşer (hata vermez).
- Migration'dan önce web deploy edilirse `get_share_preview` yok → genel önizleme; sorun yok.
- Uygulama: OTA (`eas update --channel production`) — onayınızla. Android App Links'teki yeni yollar (`/r /i /m /d /x`) yeni mağaza derlemesiyle gelir; iOS yollar AASA'dan (derleme gerekmez).

## Alan adı talimatı (İlter)
1. `l.eatkcal.com` DNS'i Vercel `landing-page` projesine bağlı olmalı (CNAME `cname.vercel-dns.com`); Vercel → Domains'e `l.eatkcal.com` ekleyin.
2. `https://l.eatkcal.com/.well-known/apple-app-site-association` `Content-Type: application/json`, yönlendirmesiz 200 dönmeli (vercel.json başlığı hazır). Apple CDN önbelleği: `https://app-site-association.cdn-apple.com/a/v1/l.eatkcal.com` ile kontrol.
3. `assetlinks.json` içindeki `REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FINGERPRINT` Play Console → Uygulama imzalama SHA-256 ile değiştirilmeli (G20'den açık).
4. Mağaza düğmeleri şimdilik metin düğme (App Store `id6763964912`, Play `com.kcalmobile.app`); resmî rozetler yayında değiştirilecek.
5. Bayrak sırası: migration → web deploy + alan adı doğrulandı → `paylasim_baglanti` → `paylasim_karti` (ikisi açıkken yeni sayfa).

## Ekran görüntüleri (`docs/night/g61/`)
- `kartlar/G61-Kart-<tür>-<story|post>-<light|dark|photo>.jpg` — 48 kart, simülatörde GERÇEK `toDataURL` çıktısı (vitrin `G61-Disa`; koyu örneklerde QR açık).
- `G61-Sayfa(-Dark)`, `G61-Kopyalandi(-Dark)`, `G61-Yukleniyor(-Dark)`, `G61-Hata(-Dark)`, `G61-Sayfa-post(-Dark)` (3 şablon), `G61-Sayfa-invite`, `G61-Sayfa-EN`, `G61-Sayfa-story-EN-Dark`.
- `web/G61-Web-<tür>-<dil>(-dark).jpg` (FinShareLanding, "Bu içerik artık yok" dahil) ve `web/G61-OG-<tür>-tr.jpg`.
- Yöntem: "G40 iPhone" simülatörü, bu worktree'den Metro (8146, CI), `scripts/dev/g14-shots.sh` storage kipi; native derleme yok. İlter'in "iPhone 17"sine dokunulmadı; çekim sonrası Metro durduruldu, görünüm/yazı boyutu sıfırlandı, simülatör kapatıldı. Web: başsız Chrome (393 pt iframe, 2×).

## SORULAR
1. **Bayrak bağı:** yeni sayfa iki bayrak birlikte açıkken çıkıyor (KARAR'daki gerekçe). `paylasim_karti` canlıda kapalıysa yalnız ona bağlamamı (bağlantısız kart kipini de açar) ister misiniz?
2. **Instagram doğrudan hikâye** (Stories API + bağlantı çıkartması) ve **galeriye Kaydet** için `expo-media-library` (+ Facebook App ID) sonraki mağaza sürümüne eklensin mi?
3. **`/s/` paylaşımı:** hikâyeyi UUID ile ayırdım. Uzun vadede saha kodlarını `/f/` gibi ayrı bir öneke taşımak ister misiniz?
4. **Anlık görüntü saklama:** öğün/gün/röntgen anlık görüntüleri süresiz (iptal edilene kadar). "Paylaşımlarım" listesi + iptal ekranı ya da 90 gün sonra silme istenir mi? (`revoke_share_snapshot` hazır, arayüzü yok.)
5. **Öğün kartı görseli:** tasarım dekupe öğün çıkartması gösteriyor; uygulamada yalnız fotoğraf var (daire içinde gösterdim). Kayıt fotoğrafının (`photo_path`, özel depo) imzalı adresle karta konması istenir mi? Şu an öğün kartı (Tracker girişi) fotoğrafsız → cam kase.
6. **Tarif paylaş girişi** (Öğün planı tarif ayrıntısı) ve **yeni kabuk Tara sonucuna** paylaş düğmesi eklensin mi?
