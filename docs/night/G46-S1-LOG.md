# G46-S1 LOG — Kayıt akışı son düzeltmeler (14 Kas)

Dal `release/1.1.0` · worktree `.claude/worktrees/g23-s1` · başlangıç `03070e4` (G42–G45 merge). Yalnız JS/TS (OTA uyumlu), yeni paket yok, deploy / OTA / canlı DB yok, migration uygulanmadı (yalnız dosya). Onboarding 1–5'e ve kayıt ekranlarının görsel diline dokunulmadı (`OnboardingScreen.tsx` diff boş).

## ÖZET
1. **md.1 L2 kilo grafiği:** Hedef dairesi (r 7 + 2,5 pt kenar) `cx = w − 6`'da çiziliyordu; SVG'nin sağ kenarını ~2 pt aşıyor ve kırpılıyordu. Şimdi her kenarda iç boşluk var: sağ/üst/alt = hedef yarıçapı + kenar kalınlığı (9,5 pt), sol = başlangıç yarıçapı + çizgi kalınlığı (9 pt). Bant ±14 pt da alanın içinde kalıyor. Ek olarak `Svg style overflow: 'visible'`. Geometri saf bir dosyada (`ui/chart.ts`) ve 320/375/402/430 pt'de, inen ve çıkan çizgi için testli. Grafik genişliği artık kartın gerçek iç genişliği (ekran − 78; önce − 84).
2. **md.2 T1 aylık:** "deneme yok" / "no trial" yazısı, erişilebilirlik etiketindeki karşılığı ve `kayit.offer.no_trial` anahtarı (TR + EN) kaldırıldı. Aylık satırda yerinde hiçbir şey çizilmiyor, boşluk kalmıyor. Deneme rozeti ve deneme koşulu metni yalnız denemesi olan (yıllık) planda. Fiyat ve yasal metin değişmedi.
3. **md.3 T1 kapatma onayı:** X doğrudan kapatmıyor; uygulamanın ortak `Sheet` bileşeniyle küçük bir onay sayfası açıyor. Sayfada brifteki başlık ve metin var (TR + EN; gün sayısı ürünün `trialDays` değerinden, 7). Lime "Denemeye başla" sayfayı kapatıp seçili planın (Balance/Fresh) denemeli yıllık ürünüyle satın almayı başlatıyor; aylık sekmedeyken de aynı. "Yine de çık" (metin düğmesi, 44 pt) HA'ya gidiyor. Scrim, kapat ve Android geri "kal" sayılıyor. Seçili planda deneme yoksa sayfa açılmıyor, X doğrudan HA'ya gidiyor (deneme metni doğru olmazdı).
4. **md.3 "bir kez" işareti (metin doğruluğu):** Kodda T1'in tekrar gösterilmesini engelleyen bir şey YOKTU. Aynı cihazda yeniden kayıt ya da mevcut hesapla A yolundan giriş T1'i yeniden açıyordu. Eklendi (`offerOnce.ts`): T1 açıldığı anda cihaza (`@kcal_kayit_offer_shown`, AsyncStorage) ve hesaba (`auth.updateUser({ data: { kayit_offer_shown_at } })` → user_metadata, şema değişikliği yok) yazılıyor. Kayıt sonrası yönlendirme (`useFinishOnAuth`) ikisine de bakıyor. Biri varsa T1 atlanıyor ve doğrudan HA (Tracker) açılıyor. Ana paywall ve genel deneme etkilenmiyor.
5. **Ölçüm:** `paywall_dismiss_confirm` (`choice: stay|leave`, sağlık değeri yok). İstemci sözlüğü `src/lib/metrics/events.ts`. Migration DOSYASI `supabase/migrations/20261114100100_g46_paywall_dismiss_confirm.sql` ve rollback hazır. Sözlük–migration eşleşme testi yeni dosyayı da okuyor.
6. **HIG düzeltmesi (denetimden):** "Denemeye başla" aylık sekmeden yıllık ürünü başlattığı için düğmenin altına mevcut `after_trial` satırı eklendi: "7 gün ücretsiz, sonra … TL/yıl. Ücret deneme bitince alınır." Dayanak: `apple-in-app-purchase.md › Clearly describe how a free trial works`.
7. **Kontroller:** hygiene ✓ · tsc ✓ · unit 1317 geçti / 0 kaldı ✓ (yeni `g46.test.ts` 5) · jest 113 paket / 723 test ✓ (yeni `g46Kayit` 17) · `expo export` iOS ✓ Android ✓ · eslint 0 hata (değişen dosyalarda yeni uyarı yok; testlerdeki `require`/`import/first` uyarıları jest.mock kalıbı, diğer testlerle aynı).
8. **Ekran görüntüleri** `docs/night/g46/`: L2 grafiği 375 / 402 / 430 pt, açık + koyu; T1 aylık açık + koyu; T1 onay sayfası açık + koyu (10 JPEG).

## Commit
| commit | içerik |
|---|---|
| `c1cc6ed` | feat(g46): md.1–3 + offerOnce + olay/migration/rollback + vitrin `G42-T1c`, `G42-L2w` + testler |
| (sonraki) | docs(g46): ekran görüntüleri `docs/night/g46` + bu LOG |
| (son) | `docs/night/G46-S1-DONE` |

## Değişen dosyalar
| dosya | ne değişti |
|---|---|
| `src/modules/kayit/ui/chart.ts` (yeni) | `WEIGHT_CHART`, `weightChartGeometry` (saf; iç boşluklu koordinatlar + yollar) |
| `src/modules/kayit/screens/PlanScreens.tsx` | `WeightCard` geometriyi kullanıyor, `overflow: 'visible'`, testID'ler; yalnız `__DEV__` `vitrinScrollY` |
| `src/modules/kayit/screens/OfferScreen.tsx` | aylıkta deneme yazısı yok; `DismissConfirm` sayfası; `close`/`stay`/`leave`; `buy(card)`; açılışta `markOfferShown` (vitrinde yazmaz) |
| `src/modules/kayit/offerOnce.ts` (yeni) | `offerAllowed(path, userMeta)`, `markOfferShown()` |
| `src/modules/kayit/storage.ts` | `OFFER_SHOWN_KEY`, `OFFER_META_KEY`, `accountOfferShown`, `shouldShowOffer`, cihaz işareti oku/yaz |
| `src/modules/kayit/screens/SignupScreens.tsx` | A yolunda `offerAllowed` false ise T1 yerine HA (Tracker) |
| `src/modules/kayit/events.ts`, `src/lib/metrics/events.ts` | `dismissConfirm` / `paywall_dismiss_confirm` |
| `src/modules/kayit/i18n.ts` | + `offer.confirm_title/body/stay/leave` (TR + EN); − `offer.no_trial` |
| `src/modules/kayit/KayitNavigator.tsx` | `KOffer` parametreleri `vitrinConfirm`, `vitrin`; vitrinde T1 işareti yazılmaz |
| `src/dev/screenCatalog.ts` | `G42-T1c` (onay sayfası açık), `G42-L2w` (grafik görünür alanda; dar ekran) — yalnız dev |
| `supabase/migrations/20261114100100_g46_paywall_dismiss_confirm.sql` + `supabase/rollbacks/…_rollback.sql` | olay sözlüğü satırı (idempotent; tablo yoksa atlanır) |
| testler | `kayit/__tests__/g46.test.ts`, `kayit/__component_tests__/g46Kayit.test.tsx`, `metrics/__tests__/metricsDictionary.test.ts` (yeni migration + rollback) |

## Testlerin kapsadığı
- md.1: 375 (açık) ve 430 (koyu) pt'de `ResultScreen` render edilir; uç dairesi + kenar SVG genişlik/yüksekliğini aşmaz. Saf geometri 320/375/402/430 pt × inen/çıkan çizgide uç noktaları, bandı ve iç boşluk eşitliklerini doğrular.
- md.2: aylıkta "deneme yok" metni, deneme rozeti ve etiketteki "deneme" yok; fiyat, `after_monthly` ve yenileme metni yerinde. Yıllıkta iki rozet ve deneme koşulu var. EN'de "no trial" yok, anahtar silinmiş.
- md.3: X ile onay sayfası açılır, `reset` çağrılmaz, TR metinleri ve deneme koşulu satırı görünür. "Yine de çık" HA'ya gider ve `leave` olayı yazılır. "Denemeye başla" aylık sekmede Fresh seçiliyken `fresh_yearly` satın almasını başlatır ve `stay` olayı yazılır. EN metinleri doğru. Metinlerde süre baskısı kelimesi yok. Olay sözlükte ve migration/rollback dosyası var.
- Bir kez: T1 açılınca cihaz anahtarı ve `updateUser({ data: { kayit_offer_shown_at } })` yazılır, ardından `offerAllowed` false döner. Hesap işareti varsa (başka cihaz) ya da B yolundaysa false döner. Hesap yazımı başarısız olsa da cihaz işareti kalır. Vitrin işaret yazmaz. Kayıt sonrası yönlendirme `offerAllowed`'a bağlı.

## Ekran görüntüleri (`docs/night/g46/`)
- `G46-L2-375` / `-Dark`: iPhone SE (3. nesil) 375 pt; grafik görünür alana kaydırılmış (`G42-L2w`).
- `G46-L2-402` / `-Dark`: iPhone 17 ("G40 iPhone") 402 pt.
- `G46-L2-430` / `-Dark`: iPhone 16 Plus 430 pt.
- `G46-T1-aylik` / `-Dark`: aylık sekme; rozet yok, boşluk yok.
- `G46-T1-onay` / `-Dark`: kapatma onay sayfası (deneme koşulu satırıyla).
Yöntem: Metro bu worktree'den (port 8146, CI kipi), `scripts/dev/g14-shots.sh` storage kipi. 375 ve 430 pt için geçici "G46 SE 375" ve "G46 Plus 430" simülatörleri oluşturuldu. Bunlara "G40 iPhone"daki 1.1.0 dev build kopyalandı (`simctl install`) ve dev client `--initialUrl` başlatma argümanıyla Metro'ya bağlandı (iOS "Açılsın mı?" onayına gerek kalmadan). Çekimden sonra bu iki simülatör silindi, "G40 iPhone" kapatıldı. Native derleme yapılmadı (disk 15 GB boş, kural ≥ 20 GB). İlter'in "iPhone 17" simülatörüne dokunulmadı.

## HIG (apple-design-skill, kod denetimi; değişen parçalar)
- Dokunma: "Denemeye başla" 56 pt, "Yine de çık" en az 44 pt, sayfa kapatma 44×44 ✓ (`accessibility.md`: iOS 44×44).
- Kontrast (hesaplanmış): açık temada başlık #10301D / #FFFFFF 14,4:1, gövde `P.sec` 5,2:1. Koyu temada başlık #FFF / #1C1C1E 17,0:1, gövde 9,8:1. Düğme yazısı / lime 10,5:1. Hepsi ≥ 4,5:1 ✓.
- Dynamic Type: tüm yeni yazılarda açık satır yüksekliği var. Sayfa gövdesi `maxFontSizeMultiplier` 1,5, başlık 1,4. Uygulamanın kayıt ekranlarındaki sınırla tutarlı; HIG'in %200 hedefinin altında (Düşük; ekran genelindeki tercih).
- VoiceOver: başlık `header` rolünde, düğmelerin etiketi var, sayfa `accessibilityViewIsModal` (ortak Sheet), odak açılışta sayfaya taşınıyor. Grafik kartın tek etiketinde özetleniyor (dekoratif).
- Azaltılmış hareket: ortak Sheet 200 ms opaklıkla açılıyor, kayma yok ✓.
- Sheet kalıbı: kapatma düğmesi ve scrim var (`modality.md › Always give people an obvious way to dismiss`). Ortak Sheet aşağı kaydırarak kapatmayı desteklemiyor (`sheets.md › Support swiping to dismiss a sheet`; Orta). Bu ortak bileşenin uygulama genelindeki davranışı, kapsam dışı (SORULAR 2).
- Tam ekran T1 modalının üstünde sayfa açılıyor (`modality.md › Let people dismiss a modal view before presenting another one`). Kapatma onayı için kabul edilebilir (yargı: tek kısa karar, eylem sayfası benzeri). Düşük.
- 5.6 / yanıltıcı baskı: metin yalnız "bu ekran" için doğru bir olgu söylüyor ve bu artık kodla garanti (bir kez işareti). Süre ifadesi yok (testli). Deneme koşulu ve ücret düğmenin altında görünüyor ✓.

## KARAR
1. **"Bir kez" = cihaz VEYA hesap:** İkisinden biri işaretliyse T1 gösterilmez. Hesap işareti için Supabase Auth `user_metadata` kullanıldı (istemci yazabilir, GoTrue anahtarları birleştirir). Yeni tablo/kolon ve canlı migration gerekmiyor. Cihaz işareti, aynı cihazda başka bir hesapla yapılan kayıtta da T1'i gizler (metin "bir daha karşına çıkmaz" her durumda doğru kalsın diye en temkinli seçenek).
2. **İşaret T1 açılınca yazılır** (kapatınca değil). Uygulama T1'deyken kapatılırsa da metin doğru kalır.
3. **"Denemeye başla" aylık sekmede:** satın alma, seçili planın (tier) denemeli yıllık ürünüyle başlar ve sekme Yıllık'a döner. Deneme yalnız yıllıkta var, düğmenin vaadi de bu. Bu yüzden sayfaya deneme koşulu + yıllık ücret satırı eklendi (HIG).
4. **Deneme yoksa onay sayfası açılmaz:** ürünlerde `trialDays` yoksa (ör. mağaza teklifi değişirse) X doğrudan HA'ya gider. Yanlış "7 gün" metni gösterilmez.
5. **`choice: stay`** hem "Denemeye başla" hem scrim/kapat/geri ile kalmayı kapsar (brif yalnız stay|leave istiyor). Satın almaya geçiş ayrıca `trial_start_reg` ile ölçülüyor.
6. **Ortak `Sheet` (core/design)** kullanıldı ("mevcut uygulama tarzı"). Uzun başlık tek satıra sığmadığı için (Sheet başlığı `numberOfLines=1`) başlık gövdede `header` rolüyle çiziliyor; sayfa başlığı alanı boş, kapat düğmesi duruyor.
7. **Gün sayısı** sabit "7" yerine ürünün `trialDays` değerinden (`{{n}}`); bugün 7.

## CANLIYA UYGULANACAK
- `supabase/migrations/20261114100100_g46_paywall_dismiss_confirm.sql` (yalnız `analytics_event_names` satırı; idempotent). Uygulanmazsa olay yine gönderilir, yalnız sözlükte açıklaması olmaz. Rollback: `supabase/rollbacks/20261114100100_g46_paywall_dismiss_confirm_rollback.sql`.

## DEPLOY GEREKİR
- Yalnız OTA (JS). `release/1.1.0` → 1.1.0 kanalı, İlter'in onayıyla. Bu oturumda deploy/OTA yapılmadı.

## SORULAR
1. **Cihaz işaretinin kapsamı:** Aynı cihazda ikinci bir kişi yeni hesapla kayıt olursa T1'i görmez. Yalnız hesap bazında istenirse cihaz anahtarını kullanıcı kimliğiyle saklamak tek satırlık bir değişiklik; ancak o zaman çıkış yapıp yeni hesapla tekrar deneme yolu açılır.
2. **Ortak Sheet'te aşağı kaydırarak kapatma yok** (HIG `sheets.md`). Uygulama genelindeki bileşen olduğu için bu oturumda değiştirilmedi. Ayrı bir iş olarak eklenmesi önerilir.
3. **Hesap işareti çevrimdışı yazılamazsa** yalnız cihaz işareti kalır; kullanıcı başka cihazda A yolundan girerse T1'i bir kez daha görebilir. Kalıcı çözüm sunucu tarafı bir alan (ör. `profiles.kayit_offer_shown_at`, migration) olur; istenirse eklenir.
