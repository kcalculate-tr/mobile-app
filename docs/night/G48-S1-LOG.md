# G48-S1 LOG — Giriş katmanı yazı/ikon, sepet hesaba özel, eatkcal konum kapısı (adres kuralı + ilçe adımı) (14 Kas)

Dal `release/1.1.0` · worktree `.claude/worktrees/g23-s1` · başlangıç `e8da652` (G47-S1-DONE vardı). Yalnız JS/TS (OTA uyumlu; 1.1.0 build 32 / Android 25). Yeni paket yok. Deploy / OTA / canlı DB yazma yok. Gerçek sipariş/ödeme yok. Migration yalnız DOSYA (+ rollback).

## ÖZET
1. **md.0 AuthSheet:** Tüm metinler Plus Jakarta Sans (başlıkta Bricolage yok). Başlık 20/700. Düğmeler 50 pt, yarıçap 25, metin 15/600, aralarında 10 pt. Koşullar · Gizlilik 12 pt. Apple düğmesi native değil, HIG'e uygun özel düğme: düz siyah dolgu (koyu temada beyaz), tek renk resmî logo, metin "Apple ile giriş yap" / "Sign in with Apple". Yalnız iOS'ta. Google "G" tek renk (metin rengi). Aynı ölçek K1'de (Apple / Google / E-posta) ve E1/E2'de (Kodu gönder / Doğrula) de var. 1,3× yazıda taşma yok.
2. **md.1 Sepet hesaba özel:** `kcal-cart` v6 artık sahipli (`ownerKey` + oturumda olmayan hesapların bekleyen sepetleri, en fazla 5). Oturum her değiştiğinde (soğuk açılış, giriş, çıkış, süre dolması, A → B) `sessionScope.applySessionUser` çalışır: başkasının sepeti ve kuponu hiç görünmez. Oturumsuz sepet girişte hesabın sepeti boşsa ona taşınır (kupon düşer), doluysa atılır. Seçili adres de aynı kurala bağlı: kullanıcıya özel, çıkışta temizlenir, girişte `hydrateSelectedAddress` sahip geçişinden SONRA doldurur. Hesap silinince o hesabın cihazdaki sepeti ve adresi silinir. Eski sahipsiz kayıtlar (`kcal-cart` v5, `kcal-selected-address` v0) ilk açılışta temizlenir.
3. **md.1 Vitrin:** `prepareScene` sepet ve adres depolarının kalıcılığını bellek içi depoya çevirir. Vitrin ürünleri ve örnek adres AsyncStorage'daki gerçek kayda ulaşmaz. Üretim paketinde vitrin kodu yok (iOS bundle'da `vitrin@example.invalid` / `G48-*` 0 eşleşme; `App.tsx` `__DEV__ ? require`).
4. **md.2 Kapı kuralı:** Oturumlu kullanıcının sunucuda kayıtlı adresi (`addresses`) yoksa eatkcal ana sayfasından önce konum kapısı açılır; varsa hiç açılmaz. Sorgu başarısızsa hesap başına önbelleklenmiş son değer kullanılır; o da yoksa kapı açılır. Cihaz geneli `eatkcal-city-gate-passed` artık yalnız oturumsuz gezinme içindir. Kural eatkcal sekmesinde, `EkCityGate` rotasında, sekmedeki ürün/mağaza eylemlerinde ve Ana sayfa eatkcal vitrininde aynı (`readEatGatePassed`).
5. **Kapı ekranı `EkLocationGate`:** CityGateView, WaitlistR1 ve FinEatBerlin'in yerini alan tek ekran (eski dosya silindi). Panolardan ölçülerek uygulandı. Arka plan tam ekran, sabit (`assets/eatkcal/gate-bg.webp`, 185 KB), açık ve koyu temada aynı. Pano "eatkcal." yazısı yerine uygulama logosu lime renkte; gerçek sekme çubuğu kaldı. Durum A: adres formu, 2×2 alan, konum düğmesi, "Restoranları gör". Durum B: Çok yakında, hap "[İlçe], [Şehir] · Değiştir" ve iki düğme. A ↔ B geçişinde yalnız alt blok değişir (180/240 ms, 8/12 pt, 60 ms kademe); azaltılmış harekette anlık. Klavye açılınca blok kayar, arka plan sabit.
6. **md.3 İlçe adımı:** Ülke → İl → (yalnız Türkiye › İzmir) İlçe listesi. Liste `delivery_zones`'tan gelir: distinct, alfabetik; aktif satırı olan ilçe "Hizmet var". Hizmet verilen ilçe + oturum → `EkAddressAdd` (ilçe dolu, il İzmir; haritanın ilk konumu ilçeyi ezmez) → kaydedilince ana sayfa ya da kapının `next` hedefi. Oturumsuzsa menü gezilebilir. Diğer her seçim Çok yakında'ya gider; sipariş akışı başlamaz. Formlar mevcut FinWaitlistAdd/Suggest sheet'leri; `district` önceden dolu, `user_id` açıkça yazılıyor. Sunucu il denetimi (`checkCity`) bayrak açıkken korunuyor.
7. **Konum düğmesi:** İzin ortak `askOnce` yardımcısından istenir; reddedildiyse sessizce hiçbir şey yapmaz. İzin varsa ters coğrafi kodlamayla ülke, il, ilçe ve posta kodu dolar; İzmir'de ilçe listedeki yazımla eşleşir.
8. **md.4 Ölçüm:** `eatkcal_gate_view {state}`, `eatkcal_gate_select {country, city, district, served}` ve `eatkcal_waitlist_submit {kind}` olayları eklendi; kişisel veri yok. Sözlük (`events.ts`), migration dosyası ve rollback dosyası yazıldı; parite testi güncellendi.
9. **Pano uyumu (ölçüldü):** Tüm metin öğelerinin konumu pano ile ±1 pt (logo → başlık → alt metin → etiket → alan → düğme; Çok yakında'da hap → etiket → başlık → gövde → düğme). Başlık Bricolage 800 34/−1,7: 3 başlık genişliği ±%2, büyük harf yüksekliği 22,3 / 22,7. Bölge SSIM (aşağıda): fotoğraf 0,97 · başlık bloğu 0,76–0,91 · gövde 0,91–0,94 · kart/düğmeler 0,77–0,78.
10. **Kontroller:** hygiene ✓ · tsc ✓ · unit 1346/1346 ✓ (yeni `g48CartOwner` 7, `g48Gate` 11) · jest 114 paket / 765 test ✓ (yeni `g48Gate` 19, `g48Auth` 9). Eski `g22Geo` ve `g24CityElse` CityGateView ile birlikte silindi. `expo export` iOS ✓ Android ✓ (kod commit'i `1d239a0` üstünde yeniden).

## Commit
| commit | içerik |
|---|---|
| `88e1edd` | md.0 AuthSheet tek font, ölçek, HIG özel Apple düğmesi, renksiz logolar; K1/E1/E2 |
| `a23a94f` | md.1 sepet + seçili adres hesaba özel, sessionScope, hesap silme, vitrin bellek deposu, saf testler |
| `9ba6ffe` | md.2–4 EkLocationGate, adres kuralı, ilçe adımı, formlar (district/user_id), olaylar + migration dosyası, AuthContext geçişi, testler |
| `1d239a0` | pano ölçüm düzeltmeleri, K1 Apple metni, ayrı seçici sheet'leri, vitrin `G48-*`, ekran görüntüleri |
| (sonraki) | docs(g48): bu LOG |
| (son) | `docs/night/G48-S1-DONE` |

## Değişen / yeni dosyalar
| dosya | ne |
|---|---|
| `src/modules/kayit/auth/AuthSheet.tsx` | tek font, 20/700 başlık, özel Apple düğmesi (native kalktı), 50 pt düğmeler |
| `src/modules/kayit/screens/SignupScreens.tsx` | `SocialButton` 50 pt · 15/600, tek renk logolar; E1/E2 `KButton size="auth"`; K1 aralık 10 |
| `src/modules/kayit/ui/parts.tsx` | `AUTH_BTN` / `AUTH_TITLE` ölçekleri, `KButton size` |
| `src/modules/onboarding/components/pieces.tsx` | `GoogleLogoMono` |
| `src/modules/kayit/i18n.ts` | `auth.apple`; K1 TR "Apple ile giriş yap" |
| `src/store/cartOwner.ts` (yeni, saf) | sahip geçişi, unutma, migrate v6 |
| `src/store/sessionScope.ts` (yeni) | `applySessionUser` (depo yüklenmesini bekler), `forgetSessionUser` |
| `src/store/storeSandbox.ts` (yeni) | vitrin bellek içi kalıcılık |
| `src/store/cartStore.ts`, `addressStore.ts`, `src/types/index.ts` | sahipli kalıcılık, `switchOwner` / `forgetOwner`, partialize, version + migrate |
| `src/core/AuthContext.tsx` | her oturum olayında sahip geçişi → sonra adres doldurma; kapı önbelleği sıfırlama |
| `src/screens/profile/SecurityScreen.tsx`, `src/modules/profil/ui/screens/SettingsSecurityScreen.tsx` | hesap silmede `forgetSessionUser` |
| `src/modules/eatkcal/gate/gateRule.ts` (yeni, saf) | kapı kuralı, İzmir ilçe listesi, hedef, ters geocode → seçim, ölçüm alanları |
| `src/modules/eatkcal/gate/eatGate.ts` (yeni) | adres sorgusu + hesap önbelleği, `useEatGate`, `useIzmirDistricts`, `markHasAddress`, vitrin zorlama |
| `src/modules/eatkcal/gate/EkLocationGate.tsx` (yeni) | kapı ekranı (A/B, seçiciler, konum, geçiş, formlar) |
| `src/modules/eatkcal/gate/i18n.ts` (yeni) | `eatkcal.gate48.*` TR + EN (pano metinleri) |
| `src/modules/eatkcal/v2/screens/EkHomeScreen.tsx` | sekme kapısı = EkLocationGate + adres kuralı; ürün/mağaza eylemleri `readEatGatePassed` |
| `src/modules/eatkcal/v2/screens/EkCityGateScreen.tsx` | rota kapısı = EkLocationGate (SignupEatGate dalı kalktı) |
| `src/modules/eatkcal/v2/screens/EkAddressAddScreen.tsx`, `v2/nav.ts` | `gateDistrict` / `afterGate` parametreleri, ilçe kilidi, `markHasAddress` |
| `src/modules/eatkcal/v2/ui/gate/WaitlistFormSheet.tsx`, `waitlistSend.ts` | `district` önceden dolu, `eatkcal_waitlist_submit`, `user_id` |
| `src/modules/eatkcal/v2/model/addressGeocode.ts` | `reverseGeocodeAdmin` (ham ters geocode) |
| `src/modules/eatkcal/v2/ui/gate/CityGateView.tsx` | **silindi** |
| `src/modules/gun/home/homeEatkcalNav.ts` | Ana sayfa vitrini aynı kural |
| `src/core/design/motion.tsx` | `EK_GATE_MOTION` token'ı |
| `src/lib/metrics/events.ts` | 3 olay |
| `src/dev/screenCatalog.ts`, `vitrinSetup.ts`, `vitrinFixtures.ts` | `G48-*` vitrin, kapı sahneleri, bellek deposu (yalnız __DEV__) |
| `assets/eatkcal/gate-bg.webp` | arkaplan.png → WebP q90, 852×1846, 185 KB (girdi dosyaları commit edilmedi) |
| testler | `store/__tests__/g48CartOwner`, `eatkcal/gate/__tests__/g48Gate`, `eatkcal/gate/__component_tests__/g48Gate`, `kayit/__component_tests__/g48Auth`; `g45Kayit`/`g47Kayit` ölçüleri, `navRule`, `g18s5Integration`, `geo.test`, `metricsDictionary` |

## Migration dosyaları (UYGULANMADI)
- `supabase/migrations/20261114200100_g48_eatkcal_gate_events.sql`: 3 olay satırı, `analytics_event_names` (idempotent; tablo yoksa atlar).
- `supabase/rollbacks/20261114200100_g48_eatkcal_gate_events_rollback.sql`
- İlçe listesi için yeni RPC gerekmedi: uygulama `delivery_zones`'u bugün de okuyor (`fetchAllDeliveryZones`, adres ekleme ekranı). Bekleme listesi tablosu canlıda var; şema değişmedi.

## Testlerin kapsadığı (brif md.5 a–f)
- (a) A ekler (kuponla) → çıkar → B: sepet boş, adres yok, kalıcı kayıtta canlı sahip B → A tekrar: 2 adet + kupon geri. A → B doğrudan geçiş, hesap silme, oturumsuz → hesap taşıma/atma. AuthContext sıralaması kaynakta.
- (b) v5 `kcal-cart` ve v0 `kcal-selected-address` rehydrate'te boş; saf `migrateCart`.
- (c) Aynı cihazda sırayla: adressiz A → kapı, adresli B → geçer, A → kapı (cihaz işareti etkisiz); adres kaydı → kapı kalkar; ağ yok → son bilinen / bilinmiyorsa kapı; oturumsuz → yalnız cihaz işareti.
- (d) Seçici akışı (İzmir → ilçe listesi "Hizmet var / Çok yakında" → Bornova) → `onServed`. Rota girişinde oturumluysa `EkAddressAdd {gateDistrict, afterGate}`, oturumsuzsa cihaz işareti + mağaza. Torbalı → Çok yakında, hap "Torbalı, İzmir", Değiştir seçimi korur. Konum düğmesi izinli/izinsiz.
- (e) Ankara, Kadıköy/İstanbul, Berlin → Çok yakında + iki düğme. Öner formu: ilçe dolu → insert `{kind, country, city, district, restaurant_name, user_id}`; olayda yalnız `kind`. Ekle formu, EN metinler.
- (f) Bellek deposuna geçtikten sonra eklenen 2 ürün gerçek `kcal-cart`ı değiştirmez; vitrin hazırlığı yazmadan önce geçer; `App.tsx` vitrin yalnız `__DEV__`.
- md.0: tek font taraması (render ağacındaki tüm fontFamily'ler PlusJakartaSans_*), ölçüler, Apple siyah/beyaz + tek renk logo, Google 4 parça tek renk, K1/E1 ölçüleri.

## Ekran görüntüleri (`docs/night/g48/`, "G40 iPhone" 402 pt)
Yan yana (sol pano, sağ uygulama), açık + koyu: `G48-pair-Gate`, `-Gate-EN`, `-District` (ilçe adımı), `-Address` (hizmet var → adres ekleme), `-Soon` (Kadıköy/İstanbul), `-Soon-EN`, `-SoonIzmir` (Torbalı, hizmet dışı İzmir ilçesi), `-SoonBerlin`, `-Add`, `-Suggest`. `G48-CartA-B(-Dark)`: sol A hesabı (dolu), sağ B hesabı (boş). Tekil: `G48-Auth`, `-Auth-Dark`, `-Auth-XL`, `G48-K1`, `-K1-Dark`, `G48-Gate-XL`, `G48-GateEmpty`.
Yöntem: Metro bu worktree'den (8146, CI kipi), G14 storage kipi ve dev client `--initialUrl`. Native derleme yok. Çekimden sonra Metro durduruldu, simülatör kapatıldı. İlter'in "iPhone 17" simülatörüne dokunulmadı. Görüntüler vitrin sahneleri (sahte oturum); A/B dokunma dizisi bileşen testinde doğrulandı.

### Ölçülü karşılaştırma (pano 393 pt ↔ uygulama 402 pt, 1 pt = 1 px, sola hizalı, blok başına en iyi dikey hiza)
| bölge | SSIM | not |
|---|---|---|
| Fotoğraf (54–400, ölçekli) | 0,97 | aynı görsel, `cover` üstten |
| Adres başlığı TR / EN | 0,91 / 0,83 | logo + başlık + alt metin |
| Adres kartı TR / EN | 0,78 / 0,78 | dayanak: alan 44 pt (HIG) ↔ pano 42,6; kart 9 pt geniş (402 pt cihaz) |
| Çok yakında başlık TR / EN | 0,76 / 0,82 | hap + etiket + 2 satır başlık |
| Çok yakında gövde TR / EN | 0,91 / 0,94 | |
| Çok yakında düğmeler TR / EN | 0,78 / 0,77 | dayanak: düğmeler 9 pt geniş (cihaz genişliği); pano altındaki sahte sekme çubuğu yok sayıldı (İlter notu b) |
Konum farkları (logo üstünden, pt): başlık +24,0 / pano +24,3 · alt metin +64,7 / +65,2 · etiket +117 / +117,3 · alan metni +149 / +149,3 · düğme +260 / +259. Çok yakında (hap üstünden): etiket +43,3 / +42,5 · başlık +63,7 / +64,2 · gövde +143,3 / +143,2 · düğme +209 / +209,5. Hepsi ≤ 1 pt.

## HIG (apple-design-skill ölçütleri, kod denetimi)
- Dokunma: alanlar 44 pt, konum 50×50, düğmeler 50–51 pt. Konum hapı 30 pt + hitSlop 8 = 46 pt. Seçici satırları ≥ 52 pt, geri 44×44. AuthSheet düğmeleri 50 pt (≥ 44 ✓).
- Sign in with Apple (HIG › özel düğme): düz siyah/beyaz dolgu, resmî tek renk logo, onaylı metin "Sign in with Apple", diğer düğmelerle aynı yükseklik, en üstte ✓.
- VoiceOver: alanlar "Ülke: Türkiye" biçiminde etiketli, başlıklar `header`. Düğmelerde durum var (`disabled` / `busy`). Kontrol hatası `accessibilityLiveRegion`.
- Dynamic Type: başlık 1,2×, diğerleri 1,3× tavan; 1,3×'te kart sığıyor (`G48-Gate-XL`). Düşük: HIG %200 hedefinin altında (uygulama geneli tercih, G46/G47 ile aynı).
- Hareket: yerel süre yok (`EK_GATE_MOTION` token'ı, `noLocalMotionTokens` ✓); azaltılmış harekette anlık geçiş.
- Kontrast (sabit koyu zemin): beyaz metin ~13:1, alt metin %88 beyaz ~10:1, etiket %58 beyaz ~6,5:1, lime üstünde koyu metin ~13:1 ✓.

## KARAR
1. **Sepet: tek kayıt + sahip (anahtar başına ayrı kayıt değil).** zustand `persist` anahtarı statik. Kullanıcıya göre anahtar değiştirmek yükleme yarışı doğurur. Bu yüzden `ownerKey` + bekleyen kutular seçildi; saf kurallar node testli. Geçiş, depo AsyncStorage'dan yüklenmeden önce istenirse yükleme bitince EN SON istenen sahiple uygulanır.
2. **Oturumsuz sepet girişte taşınırken kupon düşer:** Kupon hesap bazlı doğrulanıyor (`validate_coupon`).
3. **Bekleyen sepetler cihazda en fazla 5 hesap için tutulur:** A'nın sepeti tekrar girişte geri gelsin diye (test a). Hesap silinince o hesabınki silinir.
4. **Kapı kuralı önbelleği:** Hesap başına AsyncStorage (`eatkcal-has-address:<uid>`). Seçili adres bu hesaba aitse ilk kare "geçer" kabul edilir (boş yeşil kare yanıp sönmesin), sunucu sorgusu doğrular.
5. **`EkCityGate` rotasında `yeni_onboarding` SignupEatGate dalı kaldırıldı:** Kapı her girişte tek ekran. SignupEatGate onboarding akışında yerinde duruyor.
6. **Sunucu il denetimi (`checkCity`) korundu:** Yalnız hizmet verilen İzmir ilçesinde ve `restoran_yakinda` açıkken çalışır. Bayrak kapalıyken eskisi gibi doğrudan geçer.
7. **Başlık fontu Bricolage 800 34 / −1,7:** Pano ölçüldü. Plus Jakarta 3 başlığın genişlik oranlarını tutturamadı; Bricolage −0,05 em ile üçünü ±%2'de ve büyük harf yüksekliğini tuttu. md.0'daki "Bricolage yok" kuralı yalnız giriş katmanı için.
8. **Alan yüksekliği 44 pt** (pano 42,6): HIG asgari dokunma alanı. Fark aşağıdaki düğme satırına 1 pt yansıyor; satır arası 9 pt ile dengelendi.
9. **Üç seçici ayrı sheet:** Tek sheet hızlı "kapat → aç" sırasında kapanış animasyonu bitince gizleniyordu (testte yakalandı; cihazda 200 ms içinde ikinci alana dokununca da olur).
10. **Posta kodu:** Alan isteğe bağlı ve sayısal. Ön dolum yalnız konum düğmesinden, çünkü `delivery_zones`'da posta kodu sütunu yok; uydurma tablo yazılmadı. Yer tutucu panodaki "35040" (yalnız TR). Adres ekleme formunda posta kodu alanı olmadığı için adrese yazılmıyor (SORULAR 2).
11. **Canlı şema okuması:** `delivery_zones` RLS politikalarını okumak için yaptığım MCP sorgusu otomatik kip sınıflandırıcısınca reddedildi. Uygulamanın mevcut okuma yolu (`fetchAllDeliveryZones`, adres ekleme ekranı) zaten çalıştığı için yeni RPC/migration yazılmadı. Vitrin görüntülerindeki ilçe listesi de bu yoldan geliyor.

## CANLIYA UYGULANACAK
- `20261114200100_g48_eatkcal_gate_events.sql` (yalnız sözlük satırları; olaylar sözlük olmadan da `analytics_events`'e yazılıyor mu, D-S1 kuralına bağlı). Rollback dosyası hazır.

## DEPLOY GEREKİR
- Yalnız OTA (JS). `release/1.1.0` → 1.1.0 kanalı, İlter'in onayıyla. Bu oturumda deploy/OTA yapılmadı.

## SORULAR
1. **Bornova canlıda "Çok yakında":** Vitrinde ilçe listesi canlı `delivery_zones`'tan geliyor ve Bornova aktif satırı olmayan ilçe olarak görünüyor (pano örneği Bornova). Veri doğru mu? Ayrıca bir ilçe adı veride "Cesme" (Ç'siz) yazılmış.
2. **Posta kodu adrese yazılsın mı?** Adres formunda ve `addresses` tablosunda posta kodu alanı yok. İstenirse migration + form alanı ayrı iş.
3. **Oturumsuz form gönderimi:** RLS yalnız `authenticated` ekleme izni veriyor. Oturumsuz kullanıcının formu cihaz kuyruğunda bekler ve girişten sonra `user_id` ile gönderilir. Oturumsuz doğrudan gönderim istenirse politika değişikliği (migration) gerekir.
4. **Bölge SSIM 0,80 altı (kart/düğmeler 0,77–0,78, Çok yakında başlık TR 0,76):** Konumlar ±1 pt. Fark 402 pt cihazdaki 9 pt geniş öğelerden ve 44 pt alandan geliyor. 393 pt bir simülatörde (iPhone 16/17 Pro) yeniden ölçülebilir.
5. **Bekleyen sepetler:** 5 hesaba kadar cihazda saklanıyor (çıkıştan sonra tekrar girişte geri gelsin diye). Ortak cihazda bunun yerine çıkışta tamamen silinmesi isteniyorsa `MAX_PARKED = 0` yeterli; test (a)'nın "geri gelir" kısmı o zaman değişir.
