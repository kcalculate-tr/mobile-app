# M-S2 LOG — Mağaza paketi: kcalAI Koç 1.1.0'da AÇIK (11 Kas 2026) · dal `night28/store` (M-S1 üstüne, worktree `m-s1`)

## ÖZET
1. 5 madde tamam, her biri ayrı commit; yalnız `docs/store/*` + bu LOG. Uygulama kodu, migration, bayrak, deploy YOK; mağaza paneline girilmedi.
2. Metinler (TR/EN): Balance = "günde 50 AI tarama + kcalAI Koç"; açıklamada Koç paragrafı (öneri, tarif, eatkcal yalnız İzmir, haftalık grafik, 30 mesaj/gün, 3 deneme, tıbbi tavsiye yok); promosyon + Yenilikler'de Koç.
3. Fiyatlar ,99'lu (199,99 / 999,99 / 499,99 / 2999,99 TL; $5.99 / $29.99 / $12.99 / $59.99); bütün yasal bağlantılar `legal.eatkcal.com` (7 URL'nin hepsi 200).
4. Doğrulama betiği genişledi ve geçti: sınırlar (AS açıklama TR 3945 / EN 3993 ≤ 4000), yasak dil + "yakında" + egzersiz, ,99'suz TL, eski `eatkcal.com/...` yasal yolları, Koç zorunlu ifadeleri.
5. İnceleme notu: KCALAI COACH bölümü (Ana sayfa "Ask your coach" / Profil › AI Coach, Ücretsiz 3 deneme, Balance sandbox → 30/gün, ayrı AI izni, tıbbi soruya "Talk to a professional"); giriş şifreyle (G28 `reviewLogin`).
6. Gizlilik: Koç mesajları Apple **User Content › Other User Content** (Customer Support değil; App Functionality, bağlı, izleme yok), günlük özet Health/Fitness; Play Mesajlar › Diğer uygulama içi mesajlar + Sağlık; Anthropic ABD = işleyen.
7. Ekran görüntüleri: Koç karesi **3.** sırada (TR "Koçuna sor: kalan kalorine göre ne yesem?", EN "Ask your coach what to eat"); 7 kare × TR/EN × (6,9" + 6,5" + Play) + 2 öne çıkan = 44 PNG.
8. Fiyat karesi (07) Koç'lu paywall ile ,99'lu fiyatlar (2999,99 TL · haftalık 57,69 / $59.99, "kcalAI Koç dahil").
9. Yayın kontrolü: `koc` + `abonelik` açık, `coach-chat` yayında (teyit adımları), g24 migration şart, ASC 4 abonelik, Play 2 abonelik × 2 temel plan.
10. **İki engel:** Koç tanıtım ekranında "Yakında" rozeti (kod) ve canlı gizlilik politikasında AI sağlayıcısı / Koç bölümü yok (SORULAR 1–2).

## Değişen dosyalar
| Dosya | Madde | Commit |
|---|---|---|
| `docs/store/_uret_metinler.py` → `APP_STORE_METINLERI.md`, `GOOGLE_PLAY_METINLERI.md` | 1 | 369b48b |
| `docs/store/INCELEME_NOTU.md` | 2 | 4692dd8 |
| `docs/store/GIZLILIK_BEYANLARI.md` | 3 | 575528a |
| `docs/store/EKRAN_GORUNTUSU_PLANI.md`, `docs/store/shots/{ios,play}/{tr,en}/01–07.png` (+ `ios/*/65/`, `play/*/feature.png`), `shots/_kaynak/{prep.sh (yeni), phone.js, shots.js, compose.js}`; Play metninde kare sayısı | 4 | c392428 |
| `docs/store/YAYIN_KONTROL.md`, `docs/store/README.md` | 5 | dcddb77 |
| `docs/night/M-S2-LOG.md` + `docs/night/M-S2-DONE` | bitiş | (son) |

## KARAR
- **Koç karesi kurgusu:** `FinCoachChat` panosu 2340 pt; tek ekrana kırpıldı (`shots.js` `coachJs`): hak hapı "Bugün 28/30", ilk soru-cevap (760 kcal kaldı) başlığın altından kayar, ikinci soru panonun kendi "Akşam ne yesem?" metniyle (panoda "Proteinimi nasıl tamamlarım?") → 3 öneri kartı. Tarif/eatkcal/haftalık grafik mesajları sığmadığı için gizli. Kaynak PNG `design/tur26k/png/FinCoachChat*.webp` ile aynı pano (`tur26k/dalga2/*.dc.html`), Playwright 3×.
- **EN Koç adı:** panoda EN başlık "kcalAI Koç"; karede uygulamanın EN metni "kcalAI Coach" (`coach/i18n.ts` `name`).
- **Fiyat karesi:** Koç açık olduğu için Koç'lu paywall (`FinSubPaywallCoach`). Pano fiyatları (149 / 999 / 499 / 2999, $4.99) karalama kopyasında `prep.sh` ile ,99'a yamandı; haftalık ve indirim yeniden hesaplandı (Fresh %58, Balance %50 TL / %62 USD). Tasarım kaynağı değişmedi.
- **Kare sırası:** Koç 03; Gün 04, eatkcal/İlerleme 05, Keşfet 06, Fiyat 07. Zemin tek = lime. Play öne çıkan görsel ana sayfa karesini (artık 04) kullanır.
- **Açıklamayı 4000'e sığdırmak:** Koç paragrafı için özellik maddeleri kısaltıldı (ses örneği, hatırlatma ve çevrimdışı maddeleri çıktı, Keşfet maddeleri birleşti, eatkcal satırı kısaldı). Bilgi kaybı: "hatırlatmalar isteğe bağlı" ve "çevrimdışı kaydet" açıklamada artık yok.
- **Anahtar kelime:** TR `teslimat` → `koç`; EN `diary` → `coach` (M-S1'de Koç kapalı olduğu için alınmamıştı).
- **EN hesap silme URL'si:** yol verilmedi → TR sayfası `legal.eatkcal.com/account-deletion` (G29 md.2 "EN hesap silme aynı sayfa" kararıyla tutarlı).
- **İnceleme girişi:** M-S1 SORULAR 1 kapandı — `release/1.1.0`'da G28 `reviewLogin` var (inceleme adresinde şifre alanı). Not ve kontrol tablosu buna göre; posta kutusu web girişi seçeneği kaldırıldı.
- **Koç mesajları Play'de:** "Mesajlar › Diğer uygulama içi mesajlar" (Play tanımı "chat content"); Apple'da Other User Content. İkisi de yalnız Uygulama işlevi.

## CANLIYA UYGULANACAK
Bu oturumdan yok. Gönderim öncesi teyitler YAYIN_KONTROL A1–A4 (g24 migration uygulanmış mı, `coach-chat` sırları, `koc`/`abonelik` %100, inceleme hesabı şifreli + `koc` kilidi).

## DEPLOY GEREKİR
- **Gizlilik politikası (legal.eatkcal.com, TR + EN):** AI sağlayıcısı (ABD) + kcalAI Koç bölümü yayında olmalı (SORULAR 2).
- **Yeni native derleme:** `CoachIntroScreen` "Yakında" rozeti kaldırılırsa (JS — OTA da yeter, ama 1.1.0 derlemesine girmesi en temizi).

## SORULAR
1. **Koç tanıtım ekranı "Egzersiz planı yok · Yakında"** gösteriyor (`src/modules/coach/screens/CoachIntroScreen.tsx:75`, `coach.intro_soon`; `yakinda_satirlari` bayrağına bağlı değil, `release/1.1.0`'da da var). Kuralınız "egzersiz rehberi yakında deme / hiç anma" ile çelişiyor ve 2.3.1 riski. Rozet mi kalksın, yoksa "Egzersiz planı yok" satırı da mı? (Kod işi; bu oturum dokunmadı.)
2. **Canlı gizlilik politikası** (TR + EN, "Son güncelleme: Nisan 2026") yapay zekâ sağlayıcısını, ABD aktarımını, AI taramayı, sesli girişi ve Koç'u hiç anmıyor. Uygulama Koç için ayrı AI izni istiyor; politika güncellenmeden gönderim 5.1.1 / 5.1.2(i) riski. L-S3 taslakları + Koç bölümü ne zaman yayında?
3. **AI izni metni** (`src/lib/consent/i18n.ts` "METİN İLTER ONAYI BEKLİYOR"): Koç açıkken metin onaylı mı? Mağaza metinleri aynı içeriği söylüyor ("Koç mesajların ve günlük takip özetin … ABD … yalnız ayrıca izin verdiğinde").
4. **Kare 03 sorusu:** "Akşam ne yesem?" (panodaki üçüncü soru metni) ikinci sıraya alındı; yanıt panodaki protein yanıtı. Panodaki gibi "Proteinimi nasıl tamamlarım?" mı kalsın?
5. **Açıklamadan çıkan iki madde** (isteğe bağlı hatırlatmalar, çevrimdışı kayıt) — 4000 sınırı için. Başka bir şey mi kısaltılsın?
6. **ASC TR fiyat noktaları:** 199,99 / 999,99 / 499,99 / 2999,99 TL noktaları ASC'de mevcut mu ve ABD fiyatları TR'den türetilmeden ayrı mı girilecek (YAYIN_KONTROL C1 notu)?
7. M-S1 SORULAR 2–9 hâlâ açık (USD Fresh $5.99 kesinleşti → `demoPrices.ts` "$4.99" yorumu güncellenmeli; Payment Info; Purchase History amacı; ses metni; 285 TL örnek; dalgalı bayraklar; inceleme şubesi adı; destek e-postası).
