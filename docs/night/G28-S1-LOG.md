# G28-S1 — Logla izi, öğün fotoğrafı, satır tipografisi, ad/değer hatası, inceleme girişi, ses metni, yasal bağlantılar · 11 Kas 2026

Dal `release/1.1.0` (worktree `.claude/worktrees/g23-s1`, G27-S1-DONE üstüne). Yeni paket yok (expo-web-browser zaten derlemede). Deploy yok, canlı DB yazma yok, migration yok.
Tasarım kaynağı: `~/dev/kcal-mobile/.claude/night/design/final/png` (FinMoLogA/B, FinMoRing, FinHomeR3, FinHomeLog*) + `FinHomeR3.dc.html` ölçüleri.

## ÖZET
1. **md.4 HATA bulundu ve düzeltildi**: çevrimdışı kuyruğa alınan foto "Tekrar dene" ile AYNI anahtarla ön planda analiz edilirken bağlantı dönüşü kuyruk aynı fotoyu İKİNCİ kez analiz edip kendi sonucunu (başka ad/kcal) aynı `source_ref` ile yazıyordu; Logla benzersizlik çakışmasında o satırı sessizce döndürüyordu ("Americano … 8 kcal" → "Amerikano (sade kahve)… 5 kcal"). Porsiyon düzeltmesi de aynı yolla kayboluyordu. Kilit + sahiplenme + kayıt eşitleme + ad yeniden üretimi kalktı; test var.
2. **md.1 Logla izi A**: ortak `logTrace` + App kökünde `LogTraceHost` (yığın ekranlarının da üstünde). Tara sonucu, barkod, Keşfet, tarif (gönderi detayı), Koç "Günüme ekle" aynı yoldan. Tara'da tabak küçülüp Ana sayfa sekmesine uçar, Tara animasyonsuz kapanır; +1 rozet, success, "Öğle'ye loglandı · Geri al · Gör"; Ana sayfadaysa halka dolar (iz B aynı).
3. Geri al: kaydı siler; uçuş sürerken gelirse uçuş kesilir, tabak 200 ms solar, rozet artmaz. Azaltılmış harekette uçuş yok, rozet + toast 200 ms opaklık. Rozet en fazla 9+.
4. **md.2**: Tara kaydı artık `photo_path` yazıyor (analiz için zaten yüklenen `user-media/<uid>/scans/<anahtar>.jpg`; kuyruk dahil). Ana sayfa satırı imzalı URL (1 sa, önbellekli), yüklenirken iskelet, yoksa ürün görseli, o da yoksa kase cam nesnesi. Sonuç → liste aynı yerel kare.
5. **md.3**: satır FinHomeR3 ile eşit — ad 15/21 500 tek satır kesilir, alt satır 13 kaynak hapı + saat (büyük yazıda sarar), kcal 15/500 küçülmez.
6. **md.5**: `apple@` / `review@inceleme.eatkcal.com` yazılınca "Şifreyle giriş" (signInWithPassword) — Giriş (LoginV2 + bayrak kapalı UnifiedLogin) ve onboarding e-posta sheet'i. Adresler tek sabitte; şifre repoda yok.
7. **md.6**: ses metni AI onayı, izin ön sayfası ve iOS izin metninde aynı ifade (TR/EN). iOS metni native → sonraki derleme.
8. **md.7**: `src/lib/legal/urls.ts` tek sabit; paywall, Sözleşmeler, onay sheet'leri (kayıt, Veri izinleri, Tara AI, Koç), hesap silme → legal.eatkcal.com (açılamazsa uygulama içi metin).
9. **md.8**: tsc 0 · hygiene OK · unit 1114/0 (1 atlanan) · jest 474/474 (84 dosya) · expo export iOS (3241 modül) + Android (3248) OK · HIG denetimi (2 düzeltme).
10. Deploy/migration yok. **Yeni native derleme**: yalnız `NSSpeechRecognitionUsageDescription` metni için (geri kalan her şey OTA ile gider).

## Commit tablosu
| Madde | Commit | Özet |
|---|---|---|
| 4 (+2 kayıt) | `142d741` | Kuyruk anahtar kilidi + ön plan sahiplenme; çakışmada farklı satır ekrandaki değerlerle güncellenir (olmazsa hata); değişmeyen öğede ad aynen; kompakt sonuç `adjusted.name`; Tara kaydı `photo_path`; testler |
| 7 | `a571004` | `lib/legal/urls.ts` + `openLegal`; paywall / Sözleşmeler / onay sheet'leri / hesap silme; tek dosya bekçisi |
| 6 | `378a97d` | Ses metni TR/EN (consent i18n, voice i18n, app.config, locales); bekçi testi |
| 5 | `914333f` | `lib/auth/reviewLogin` + `useReviewPasswordLogin`; LoginV2, UnifiedLogin, AccountEmailSheet; testler |
| 2 · 3 | `4e8d8f8` | `gun/mealPhoto` + `useMealPhoto`; MealThumb (iskelet / kase); satır tipografisi; testler |
| 1 | `54831a9` | `shell/logTrace` + `LogTraceHost` (App kökü); TabBarR3 yalnız rozet; 4 kaynak + barkod; testler |
| 8 | `dbb578a` | HIG: varış VoiceOver duyurusu; Koç'ta çift success haptiği kalktı |
| — | (bu commit) | LOG; ardından `G28-S1-DONE` |

## md.4 kök neden (ayrıntı)
- Edge `analyze-ai-scan` rezervasyon `reserved` iken gelen ikinci isteği yeniden modele gönderir (önbellek yalnız `consumed`'da). Çevrimdışı kuyruğa alınan foto (anahtar K) için "Tekrar dene" ön planda K ile analiz başlatırken NetInfo bağlantı dönüşü `drainPendingScans` da K'yı analiz etti → iki farklı model yanıtı. Kuyruk kendi sonucunu `source_ref=K` ile yazdı; kullanıcı Logla'ya basınca 23505 → `fetchExisting` kuyruğun satırını döndürdü, ekran "loglandı" dedi.
- İkinci yol: kuyruk ön plandan önce bitirirse kullanıcının porsiyon/öğe düzeltmesi de aynı çakışmada kayboluyordu.
- Ayrıca kompakt sonuç başlığı `estimate.name`, kayıt `adjustedName` (öğe adlarının birleşimi) yazıyordu — model adı öğe adından farklı olduğunda (öksüz sonuç, ses) ad değişiyordu.
- Düzeltme: (a) `offlineQueue` ön plan kilidi — kuyruk kilitli anahtarı atlar; (b) ön plan analizi başarılıysa kuyruk girdisi ön plana geçer (kuyruktan çıkar, kopya dosya silinir); (c) `saveAiScanEstimate`: çakışmada mevcut satır ekrandakinden farklıysa kullanıcının onayladığı değerlerle GÜNCELLENİR, güncellenemezse hata (yanlış kayıt "loglandı" gösterilmez); (d) öğe değişmediyse ad aynen; ekran da `adjusted.name` gösterir.
- Canlı DB'de iki kaydı doğrulamak için salt-okuma sorgusu reddedildi (izin) — kök neden koddan çıkarıldı (SORULAR 1).

## KARAR
1. **Logla izi kökte**: Tara/Koç/gönderi detayı sekme çubuğunun üstünde yığın ekranları; çubukta çizilen uçuş ve toast görünmüyordu. Uçuş + toast `LogTraceHost`'a (App kökü, NavigationContainer'ın kardeşi, yalnız `yeni_kabuk`) taşındı; TabBarR3 yalnız "+N" rozetini çizer ve Ana sayfa sekmesi hedefini bildirir.
2. **Tara loglayınca kapanır** (animasyonsuz; azaltılmış harekette solarak) — FinMoLogA "tabak Ana sayfa sekmesine uçar" ve "+1 rozet" sekme çubuğu görünürken anlamlı. Plana ekle / Kaydet / Koç düğmeleri Logla'dan önce kullanılabilir. Barkod da aynı şekilde kapanır (tabak görseli yok → uçuşsuz rozet + toast).
3. **Uçuş eğrisi**: konum AI yayı 260/24 (FinMoLogA), ölçek/opaklık `TIMING.logTrail` (slow bandı) enter eğrisi; varış ölçek/opaklık bitince. Toast sırası storyboard'daki gibi varıştan sonra.
4. **Koç / tarif kendi toast'larını göstermez** (tek toast = Logla izi toast'ı, Geri al ile). Keşfet'in ekran içi eski LogTrail yankısı oynatılmaz (iki iz olmasın).
5. **Koç logu artık `log_add` sayılır** (köprü üzerinden, kaynak `manual` — satırın DB kaynağıyla aynı). Önceden Koç eklemeleri hiç sayılmıyordu.
6. **Öğün fotoğrafı yolu** = analizde zaten yüklenen dosya (yeni yükleme/Storage değişikliği yok, RLS sahibi okur). Yol bulunamazsa oturumda tekrar istenmez; ağ hatası kalıcı sayılmaz.
7. **Kase cam nesnesi listede durağan png** (`assets/glass/bowl.png`); GlassObject'in süzülme/nefes animasyonu 44 pt satırda gürültü olurdu.
8. **İnceleme girişi**: 18+ / kabul kutusu kod akışıyla aynı koşul; e-posta sheet'inde kabul kaydı kod akışıyla aynı (`acceptPolicies`). Adres tam eşleşme (boşluk/büyük harf yok sayılır).
9. **Ses metni**: anlam değişmedi (ses kaydedilmez, yalnız metin gider) → `AI_PHOTO_TEXT_VERSION` artırılmadı, izin yeniden sorulmaz.
10. **Yasal**: iOS paywall EULA Apple standart EULA'da kaldı (G25 kararı); Android EULA → web Koşullar. KVKK / mesafeli satışın web yolu verilmedi → uygulama içi. EN hesap silme yolu verilmedi → `/account-deletion` (TR ile aynı). `/destek` sabitte var, bu oturumda bir ekrana bağlanmadı (görev listesinde yer yoktu). Sözleşmeler ekranı metni uygulama içinde göstermeye devam eder, altında "Web sitesinde aç".

## HIG (apple-design-skill, kod denetimi)
- motion.md › "Make motion optional": azaltılmış harekette uçuş yok; sonuç toast + VoiceOver duyurusu ile de iletilir — **düzeltildi**: iOS'ta `accessibilityLiveRegion` çalışmadığı için varışta `AccessibilityInfo.announceForAccessibility` (dbb578a).
- motion.md › "Let people cancel motion": uçuş dokunmayı engellemez (`pointerEvents=none`), Geri al uçuşu keser. › "brevity": ~550 ms.
- playing-haptics.md › tutarlılık: success yalnız varışta bir kez — **düzeltildi**: Koç kartı ikinci success çalıyordu.
- Öğün satırı: görsel dekoratif (`accessible={false}`), satır etiketi tam adı + kaynak + saat + kcal okur (kesilen ad VoiceOver'da tam); dokunma alanı ≥ 44 pt; ad tek satır kesilir (görev tanımı), alt satır büyük yazıda sarar, kcal küçülmez. AppText gövde tavanı 1,6× (HIG ≥ %200 önerisi; Ana sayfa tavanı G15 kararı) — değiştirilmedi.
- Şifre alanı: önceden doldurulmaz (entering-data.md › "Never prepopulate a password field"), `textContentType=password` (anahtarlık), güvenli giriş.
- Yasal bağlantılar: rol `link`, ≥ 44 pt, dış bağlantı ikonu, erişilebilirlik etiketi.
- Gerçek cihaz/simülatörde görsel doğrulama yapılmadı (simülatör derlemesi bu oturumda yok).

## CANLIYA UYGULANACAK
- Yok (migration yok). İnceleme hesapları: İlter Supabase Auth'ta `apple@inceleme.eatkcal.com` (ve isterse `review@…`) hesabını ŞİFREYLE oluşturmalı (Dashboard ya da Admin API; şifre App Store Connect inceleme notuna).

## DEPLOY GEREKİR
- **Yeni native derleme**: yalnız `NSSpeechRecognitionUsageDescription` metni (app.config infoPlist + expo-speech-recognition eklentisi + locales). Sonraki derlemede geçerli; G26/G27'nin istediği derlemeye girer.
- Geri kalan tüm değişiklikler JS → OTA ile gidebilir (yeni paket/native modül yok; expo-web-browser zaten derlemede).
- `legal.eatkcal.com` altındaki 7 yolun canlıda olduğu doğrulanmadı (açılamazsa uygulama içi metne düşer).

## Cihazda doğrulanacak
- Tara → Logla: Tara anında kapanıp tabağın Ana sayfa sekmesine uçtuğu, Ana sayfadaysa halkanın dolduğu (native-stack `animation: 'none'` ile pop).
- Koç / gönderi detayında uçuşun ekranın üstünde göründüğü (kök katman yığın ekranlarının üstünde; gerçek `presentation: modal` ekranında değil — bu akışlarda yok).
- Taranan öğünün Ana sayfa satırında küçük görsel olarak geldiği (yeni kayıtlar; eski Tara kayıtlarında yol yok → kase).

## SORULAR
1. TestFlight'taki o iki kaydı (Americano 8 / Amerikano 5) canlıda doğrulamak için salt-okuma `meal_consumptions` sorgusu izinle reddedildi. İzin verilirse kök nedenin bu olduğunu kayıt saatleri/`source_ref` ile teyit edebilirim.
2. Tara loglayınca ekranın kapanması (FinMoLogA) uygun mu, yoksa sonuç ekranı açık kalıp yalnız rozet/toast mı istenir?
3. `/destek` web sayfası Profil › Destek'e de bağlansın mı? EN hesap silme için ayrı yol (`/en/account-deletion`) var mı?
4. Eski Tara kayıtları için (photo_path boş) depodaki `scans/` dosyalarından geriye dönük doldurma yapılsın mı? (Canlı DB yazımı — onay gerekir.)
5. Edge `analyze-ai-scan`: aynı anahtarla `reserved` iken gelen ikinci istek için "işleniyor" yanıtı (409) verilsin mi? İstemci artık çakışmayı önlüyor; sunucu tarafı ek güvence olur (deploy gerekir).
