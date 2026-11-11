# M-S1 LOG — Mağaza paketi 1.1.0 (11 Kas 2026, gece) · dal `night28/store` (taban `release/1.1.0` @ bd96421)

## ÖZET
1. 5 madde tamam, her biri ayrı commit; yalnız `docs/store/*` + bu LOG. Uygulama kodu, migration, bayrak, deploy YOK; mağaza paneline girilmedi.
2. Metinler TR/EN yeniden: ad `KCAL: AI Kalori Hesaplama` / `KCAL: AI Calorie Counter`, alt başlık, anahtar kelime (tekrarsız, ≤ 100 bayt), promosyon, açıklama, yenilikler.
3. Açıklamada abonelik bölümü: Ücretsiz / Fresh / Balance hakları + fiyatlar, otomatik yenileme, iptal, Koşullar + Apple EULA + Gizlilik bağlantıları. "Uygulama içi satın alma YOK" satırları kaldırıldı.
4. Üretici betik (`_uret_metinler.py`) sınırları, anahtar kelime tekrarını, yasak dili (kilo vaadi, önce/sonra, "sınırsız AI", Koç/yakında, ₺) ve zorunlu bağlantıları denetliyor — geçti.
5. İnceleme notu (EN): `apple@inceleme.eatkcal.com`, şifre `[İLTER]`; Sandbox abonelik testi, AI foto + ses, eatkcal İzmir + test adresi (şirket adresi, Karabağlar); Koç anılmıyor.
6. Gizlilik: Apple 18 tür, hepsi bağlı, **izleme yok** (G26); Play Data safety soru soru; G26 + L-S3 tutarlılık tablosu (9 madde).
7. Ekran görüntüleri: 6 kare × TR/EN × (iOS 6,9" + 6,5" + Play 1080×1920) + 2 Play öne çıkan görsel = **38 PNG**. Kaynak = Final panoları (gerçek ekran görüntüsü DEĞİL), Playwright 3×.
8. Yayın kontrol listesi: canlı (G20–G27 migration'ları, revenuecat-webhook, bayraklar, Koç kapalı, coach-chat sonra), derleme, ASC (abonelikleri sürüme ekle, App Privacy, kategori, URL, EULA), Play (abonelik, veri güvenliği, hesap silme, reklam, IARC, hedef kitle).
9. **Engel:** EN gizlilik/koşullar/destek sayfaları ve TR `/destek` canlıda 404 (route'lar kcal-web'de var) → web deploy gönderimden önce şart (YAYIN_KONTROL A5).
10. Ses: iOS/Android'de cihaz desteklemezse tanıma işletim sisteminin sunucusunda yapılıyor; metinlerde "ses kaydı tutulmaz" dendi, "tamamen cihazda" denmedi (SORULAR 5).

## Üretilen dosyalar
| Dosya | Madde |
|---|---|
| `docs/store/_uret_metinler.py` → `APP_STORE_METINLERI.md`, `GOOGLE_PLAY_METINLERI.md` | 1 |
| `docs/store/INCELEME_NOTU.md` | 2 |
| `docs/store/GIZLILIK_BEYANLARI.md` | 3 |
| `docs/store/EKRAN_GORUNTUSU_PLANI.md`, `docs/store/shots/{ios,play}/{tr,en}/NN.png` (+ `ios/*/65/`, `play/*/feature.png`), `docs/store/shots/_kaynak/{phone,shots,compose}.js` | 4 |
| `docs/store/YAYIN_KONTROL.md`, `docs/store/README.md` | 5 |

## Commit tablosu
| Commit | Madde |
|---|---|
| 008acd0 | 1 — mağaza metinleri TR/EN |
| 22078b3 | 2 — inceleme notu |
| 648ffa3 | 3 — gizlilik beyanları |
| 525d663 | 4 — ekran görüntüleri + plan |
| a8870ab | 5 — yayın kontrol listesi |
| (son) | `docs/night/M-S1-LOG.md` + `docs/night/M-S1-DONE` |

## KARAR
- **USD fiyatı:** M-S1 kararı Fresh **$5.99**/$29.99 kullanıldı; kodda `src/lib/subscription/demoPrices.ts` hâlâ "$4.99" diyor (yalnız test/vitrin; uygulama fiyatı RevenueCat'ten alır). SORULAR 2.
- **Ekran görüntüsü kaynağı:** panolar 1× WebP (393 px) — büyütmek bulanıktı → `.dc.html` kaynakları karalama kopyasından (`$CLAUDE_JOB_DIR`) Playwright ile 3× çizildi; tasarım kaynağına yazılmadı.
- **Yer tutucular:** `[N]`, `[Ad]`, `[Ürün]`, gri fotoğraf kutuları tutarlı örnek veriyle dolduruldu (liste EKRAN_GORUNTUSU_PLANI); kullanıcı adı "İlter" → "Elif". Kare 02 için Final'de ses kipi olan `ScanR2` panosu kullanıldı; EN kare 02'de etiketler uygulamanın kendi EN metinleriyle değiştirildi (EN pano yok).
- **Kare 04 EN** = "Track your progress": `FinTrackerEN` (ilerleme ekranının EN panosu yok).
- **Koç:** hiçbir metinde/karede yok; gizlilik beyanı Koç verisini şimdiden kapsıyor (derleme yeteneği; L-S3 Play not 2).
- **Payment Info = Evet** (manifestle aynı, ihtiyatlı); L-S3 "Hayır" öneriyor → SORULAR 3.
- **Purchase History / Product Interaction amacı** manifestteki gibi Third-Party Advertising bırakıldı (değişirse yeni derleme gerekir) → SORULAR 4.
- **Anahtar kelime:** raporun önerdiği "zayıflama, ver" alınmadı (yasak dile yakın); "kilo" kaldı. EN'de "coach" alınmadı (Koç kapalı).
- **Pazarlama URL'si** `https://eatkcal.com` (kcalculate.ai yanıt vermiyor).
- **İnceleme test adresi:** KURUMSAL_KIMLIK'teki şirket adresi (Karabağlar, teslimat bölgesi içinde — `DeliveryInfoModal`); şube adı `[İLTER]` (canlı `branches` okuması otomatik izin denetçisince reddedildi).
- **Telif:** `2026 SEKULART LTD` (L-S1 KURUMSAL_KIMLIK 9 Kas kararı).

## CANLIYA UYGULANACAK
Bu oturumdan yok. Gönderim öncesi canlı adımlar YAYIN_KONTROL A1–A5 (migration'lar G20–G27, revenuecat-webhook, bayraklar, inceleme hesabı, web).

## DEPLOY GEREKİR
- **kcal-web (eatkcal)**: `/destek`, `/en/support`, `/en/legal/terms`, `/en/legal/privacy`, `/en/account-deletion` canlıda 404 — mağaza gönderiminden önce.
- Yeni native derleme (G26/G27'den; bu oturum eklemedi).

## SORULAR
1. **İnceleme girişi:** uygulamada şifre alanı yok (e-posta kodu). `inceleme.eatkcal.com` posta kutusunun web girişi App Review'a verilecek mi (formdaki "Password" = posta kutusu şifresi)? Alternatif: yalnız inceleme hesabı için şifreyle giriş (kod işi) ya da Supabase'de sabit kod — hangisi?
2. **USD Fresh aylık:** $5.99 (M-S1 kararı) mı, $4.99 (kod yorumu `demoPrices.ts`, tur26k README) mı? ASC/Play fiyatı buna göre girilecek; demoPrices yorumu güncellenmeli.
3. **Payment Info** (eatkcal kayıtlı kart son 4 + jeton): beyan Evet (bugünkü manifest) mi, L-S3'ün önerdiği Hayır mı? Hayır ise manifest + iki form birlikte değişir.
4. Purchase History / Product Interaction amacı "Third-Party Advertising" yerine "Developer's Advertising or Marketing" olsun mu (Meta bizim reklamımızı gösteriyor)? Manifest değişikliği yeni derleme ister — 1.1.0'a mı 1.1.x'e mi?
5. **Ses:** cihaz desteklemezse tanıma Apple/Google sunucusunda. Metinler "ses kaydı tutulmaz" diyor (doğru). İzin metni "telefonunda yazıya çevirmek" — yeterince ihtiyatlı mı, yoksa "telefonun konuşma tanımasıyla" mı denmeli?
6. **Kare 04 TR fiyatı** "Tavuk Kinoa Bowl 285 TL" örnek — gerçek menü fiyatı/ürün adı ile değiştirilsin mi (`shots/_kaynak/shots.js`)?
7. **Dalgalı bayrak açılışı:** açıklama ve kareler Keşfet, gün halkası, ilerleme, eatkcal yeni akış vb. anlatıyor; yayın günü bu bayraklar %100 değilse 2.3.1 riski. Yayın günü hangi bayraklar %100?
8. İnceleme hesabı için eatkcal şubesinin adı (Notes'ta `[İLTER: branch name]`).
9. Destek e-postası `info@eatkcal.com` mı, ayrı bir destek adresi açılacak mı (Play herkese açık iletişim)?
