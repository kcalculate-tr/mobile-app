# G15-S2 — Ana sayfa + Su + Tara + Gün + Kutlama (opus)

## ÖZET (10 satır)
(1) Dal `night15/home` (taban `night14/visual` `a1fe71f`), worktree `.claude/worktrees/g15-s2`, simülatör kopyası "G15-2 iPhone" (`E331640E-…782C`), Metro `--port 8092`. 12 iş commit'i.
(2) Su takibi: migration DOSYASI `supabase/migrations/20261106000100_g15_water.sql` (water_daily, RLS yalnız sahibi, `log_water(ml)`, `su_takibi` satırı kapalı/1.1.0) + rollback; canlıya UYGULANMADI. Bayrak `su_takibi` (registry false). Ana sayfada Final Su halkası; dokun = +250 ml + "Geri al".
(3) Ana sayfa: Enerji 92 / Protein 64 / Su 64 halkalar, boş günde "İlk öğününü logla", Final makro çipleri, eatkcal yatay şeridi + Keşfet video şeridi (gerçek veri, yoksa gizli), teslim anı (kase + "Akşam’a loglandı · Geri al · Gör"), satır içi porsiyon + Kaldır, Akşam damla işareti.
(4) Koyu tema: R3 kabukta durum çubuğu temadan; eski "Kalori Ekle" modalı → Final elle giriş sheet'i; eski Makrolar/Su kartı yalnız bayrak kapalı; yükleniyor/hata Final; cam nesnenin koyu temadaki gri karesi giderildi.
(5) XL/EN: AppText `fontWeight` → doğru Jakarta/Bricolage dosyası (sistematik), ana sayfa 1.3× tavan, sekme etiketleri kırpılmıyor; EN "50%", porsiyon "0.5/1.5", "Explore/See all".
(6) Tara: FinScanR2 vizörü, FinPhotoR1 foto + makro sheet (halka⇄çubuk, gram, eksik besin arama, "Planıma ekle" = yerel plan hatırlatması, "Bu öğünü kaydet" = tabak koleksiyonu, Geri al/Gör), "Kameraya erişim kapalı" ayrı durum, Final hata sayfaları.
(7) Gün/kutlama/koleksiyon: görüntüleyici + özet slaytları, kutlama, "Kart kazandın", tabak detayı + Tekrar logla, tek tabak sonucu + menü eşleşme yüzdesi, profilde koleksiyon şeridi + "Koleksiyonuna eklendi · Gör"; stres panoları için gerçek bileşenli kabul sahnesi.
(8) Pano tablosu (son tur, `3a52f64`): 56 görüntü → önce (G14) aynı 0 · küçük 15 · büyük 39 · ekran yok 2 → sonra **aynı 4 · küçük fark 52 · büyük fark 0**. `Eski tasarım: 0`.
(9) Kontrol (`3a52f64`): tsc 0 · test:unit 536/536 · test:components 92/92 (TrackerScreen.flagOff snapshot aynı) · `expo export --platform ios` ✓ (9.34 MB) · KİMSE diff boş.
(10) Son commit GERÇEK dosya `docs/night/G15-S2-DONE`. SORULAR: 8 madde.

## Commit'ler
| Commit | İçerik |
|---|---|
| `446ceb2` | Su migration + `su_takibi`, FinTopBlock, HomeStrips, HomeInkToast, HomeManualMealSheet, eski Makrolar/Su yalnız kapalı, R3 durum çubuğu, GlassObject, vitrin Final verisi |
| `ba4434f` | XL/EN + AppText ağırlık eşlemesi, 1.3× tavan, sekme etiketleri, EN biçimleri, porsiyon satırı, kase konumu |
| `99bf1ec` | Tara: FinScanViewfinder, FinPhotoResult, FinScanErrorSheet (`camera` türü), Geri al |
| `59bb09c` | GunViewer, CelebrateOverlay, vitrin örnekleri |
| `a3d7c2d` | CollectionWon, CollectionCardDetail, kompakt foto sonucu, profil koleksiyon şeridi |
| `553bf5d` | Stres kabul sahnesi (`src/dev/vitrinStress.tsx`) |
| `b9dc909` | Envanter: yükleniyor/hata, ShareMealCardModal, FinAddSheet vitrini |
| `aabdeaf` | Karşılaştırma turu düzeltmeleri + `g15water.test.ts` + bayrak-açık eski bölüm testi |
| `7b05e61` | Gün tamamlandı satırı, koyu temada kart |
| `3a52f64` | Planıma ekle + Bu öğünü kaydet + eşleşme yüzdesi + koleksiyon toast'ı + `g15match.test.ts` + `FinPhotoResult.test.tsx` |

## Pano tablosu (önce G14 → sonra G15, son tur)
Yöntem: `scripts/dev/g14-shots.sh` (UDID/OUT değişkenli) ile 56 görüntünün tamamı `3a52f64` üzerinde yeniden çekildi → `G14_SET=g15s2 npx tsx scripts/dev/g14-pair.ts` → Final (sol) | uygulama (sağ). İki bağımsız görsel inceleme (28+28) + kendi kontrolüm. Çiftler: `.claude/worktrees/g15-s2/.claude/night/out/g14/pair-g15s2/`.
Kabul edilen veri farkları (tabloda tekrar yazılmadı): mock yemek fotoğrafı yok (gri/koyu yer tutucu, bulanık foto zemini yok), vitrin adları "Deniz"/"Dyt. Elif" (Final "İlter"/"Dyt. [Ad]"), `[N]` yerine gerçek sayılar, Final'in spec etiketleri/"Reduced motion" anahtarı, telefon görünümünün altında kalan içerik.

| Pano | Önce (G14) | Sonra (G15) | Kalan farklar |
|---|---|---|---|
| FinHomeR3 | büyük fark | küçük fark | halka/başlık ölçüsü birkaç pt; sekme çubuğu Akşam satırına biniyor (görünüm kesimi) |
| FinHomeR3-Dark | küçük fark | küçük fark | aynı |
| FinHomeEmptyR1 | büyük fark | aynı | — |
| FinHomeEmptyR1-Dark | büyük fark | aynı | — |
| FinHomeDelivered | büyük fark | küçük fark | halka teslim edilen öğünü saymış (%73; Final sayılmadan önceki an %50); kase/toast konumu birkaç pt |
| FinHomeDelivered-Dark | büyük fark | küçük fark | aynı |
| FinHomeEN | büyük fark | küçük fark | ölçü/boşluk |
| FinHomeEN-Dark | küçük fark | küçük fark | ölçü/boşluk |
| FinHomeXL | büyük fark | küçük fark | "Akşam’a logla" sekme çubuğunun altında kalıyor |
| FinHomeXL-Dark | küçük fark | küçük fark | aynı |
| FinHomeLogBefore | büyük fark | küçük fark | "Akşam’a logla" hapı sekme çubuğunun arkasında (Final panosunda çubuk yok) |
| FinHomeLogBefore-Dark | büyük fark | küçük fark | aynı |
| FinHomeLogFlow | büyük fark | küçük fark | akış çizgisi hareket karesi; aynı hap konumu |
| FinHomeLogFlow-Dark | büyük fark | küçük fark | aynı |
| FinHomeLogMerged | büyük fark | küçük fark | hap konumu |
| FinHomeLogMerged-Dark | büyük fark | küçük fark | aynı |
| FinAddSheet | büyük fark | küçük fark | arka plan Keşfet başlığı yerine örnek gönderi (vitrin zemini); sheet birkaç pt aşağıda |
| FinAddSheet-Dark | büyük fark | küçük fark | aynı |
| FinScanR2 | büyük fark | aynı | — |
| FinScanR2-Dark | büyük fark | aynı | — |
| FinPhotoR1 | büyük fark | küçük fark | toast logla hapına yakın; sheet birkaç pt yukarıda (Planıma ekle / Bu öğünü kaydet görünüm altında, bileşen testiyle doğrulandı) |
| FinPhotoR1-Dark | büyük fark | küçük fark | aynı |
| FinPhotoEN | büyük fark | küçük fark | aynı |
| FinPhotoEN-Dark | büyük fark | küçük fark | aynı |
| FinScanError | büyük fark | küçük fark | sheet birkaç pt kısa |
| FinScanError-Dark | büyük fark | küçük fark | aynı |
| FinErrFailed | küçük fark | küçük fark | sheet yüksekliği, not hapı satır kırılması |
| FinErrFailed-Dark | küçük fark | küçük fark | aynı |
| FinErrOffline | küçük fark | küçük fark | wifi-off ikon çizgisi; sheet birkaç pt kısa |
| FinErrOffline-Dark | küçük fark | küçük fark | aynı |
| FinErrLimit | küçük fark | küçük fark | başlık/gövde 1–2 pt |
| FinErrLimit-Dark | küçük fark | küçük fark | aynı |
| FinGunView | büyük fark | küçük fark | başlık satırı/kart içi yerleşim birkaç pt |
| FinGunView-Dark | büyük fark | küçük fark | aynı |
| FinGunEnd | büyük fark | küçük fark | öğün sırası Kahvaltı/Öğle/Akşam (Final Öğle/Akşam/Kahvaltı); halka konumu |
| FinGunEnd-Dark | büyük fark | küçük fark | aynı |
| FinGunDone | büyük fark | küçük fark | aynı |
| FinGunDone-Dark | büyük fark | küçük fark | aynı |
| FinCelebrate | küçük fark | küçük fark | kart/alev birkaç pt küçük ve yukarıda |
| FinCelebrate-Dark | küçük fark | küçük fark | aynı |
| FinCelebStreak3 | küçük fark | küçük fark | "Nedenin: …" satırı yok — onboarding'de "neden" verisi yok, satır veri olunca çizilir (SORULAR 4) |
| FinCelebStreak3-Dark | küçük fark | küçük fark | aynı |
| FinCelebStreak7 | küçük fark | küçük fark | aynı (kupa → alev düzeltildi) |
| FinCelebStreak7-Dark | küçük fark | küçük fark | aynı |
| FinCollectCut | büyük fark | küçük fark | sol üstte geri düğmesi; alt bölüm birkaç pt aşağıda ("%92 eşleşme" menü eşleşmesinden) |
| FinCollectCut-Dark | büyük fark | küçük fark | aynı |
| FinCollectWon | büyük fark | küçük fark | "Lifli" etiketi yok (lif verisi yok; etiketler veriden türetilir); kart birkaç pt küçük |
| FinCollectWon-Dark | büyük fark | küçük fark | aynı; kart koyu |
| FinCollectGrid | büyük fark | küçük fark | detay tam ekran (Final'de altta sekme çubuğu) |
| FinCollectGrid-Dark | ekran yok | küçük fark | aynı |
| FinCollectEntry | büyük fark | küçük fark | şerit + "Yeni" + "Koleksiyonuna eklendi · Gör" Final'le aynı; toast sekme çubuğuna yakın; profil gövdesi güncel FinPrProfile panosuna göre (bilinen pano çakışması, S4) |
| FinCollectEntry-Dark | büyük fark | küçük fark | aynı |
| FinStressLong | büyük fark | küçük fark | bölüm sırası aynı, kırpılma yok; para biçimi eatkcal `money()` ("12345.50 TL" / Final "₺12.345,50" — S5, ENTEGRASYONA) |
| FinStressXL | büyük fark | küçük fark | bölüm sırası aynı, kırpılma yok |
| FinStressEN | büyük fark | küçük fark | bölüm sırası aynı, kırpılma yok |
| FinStressDark | ekran yok | küçük fark | bölüm sırası aynı, kırpılma yok |

Dağılım: önce aynı 0 · küçük fark 15 · büyük fark 39 · ekran yok 2 → sonra **aynı 4 · küçük fark 52 · büyük fark 0 · ekran yok 0**.

## Eski tasarım: 0
Bayraklar açık (FINAL_FLAGS + `su_takibi`), alan: Ana sayfa, Tara, Gün, kutlama, öğün ekleme/düzenleme. Taranan ve Final'e taşınan/giydirilen:
1. Eski "Makrolar · Detay için tıkla →" MacroRing kartı → üst blok makro çipleri (dokun → hedef düzenle: `TakibeBasla{editGoal}` / bayrak kapalıyken `NutritionProfile`).
2. Eski "Su Takibi · 8 bardak" kartı → Final Su halkası (`su_takibi` açık: sunucu; kapalı: 1.0.7'deki cihaz içi sayaç).
3. Eski "Kalori Ekle" Modal (COLORS, emoji çipler) → `HomeManualMealSheet` (aynı form/kayıt).
4. Global `StatusBar style="dark"` → R3 kabukta temadan.
5. Yükleniyor (`COLORS.brand.green`) + hata (eski Text + "Tekrar Dene") → tema spinner + `EmptyErrorCard`.
6. Cam nesnenin kare sheen'i (koyu temada gri kare) → nesne şekilli parlama.
7. `ShareMealCardModal` sabit koyu + eski lime `#B9EF14` → tema + Final sheet.
8. Tara vizörü (koyu kamera, üst mod çipleri, beyaz deklanşör) → FinScanR2.
9. Kamera izni reddi `Alert.alert` → FinScanError `camera`.
10. FinPhotoResult kart listesi → foto + makro sheet.
11. FinScanErrorSheet düz yerleşim → Final tam ekran.
12. GunViewer açık zemin/okunmayan beyaz başlık, "Günüme ekle" → Final.
13. Kutlama ince vurgu, ShareNetwork, büyük alev, 7. günde kupa → Final.
14. "Kart kazandın" ortalı/yan yana/görünmez Paylaş → Final.
15. Koleksiyon ızgarasından "Kart kazandın" açılması → tabak detayı.
16. Hata kartı başlığı kırmızı → mürekkep (Final).
Kalan: yok. (Ana sayfa kayıt silme hatasında iOS sistem `Alert`'i — tasarım bileşeni değil.) Kanıt: `TrackerScreen.flagOn` testi eski bölümlerin ("Makrolar", "Su Takibi", "Kalori Ekle", "Detay için tıkla →") render OLMADIĞINI doğrular.

Taşınan (Final karşılığı var; G14'te yeni kabuktan kaldırılmıştı): Geçmiş, Özet/Grafik, tarih hapları → Profil › İlerleme (FinPrProgress: gün çipleri, kalori grafiği, hedef/makro uyumu, makro dağılımı, ölçümler + "Ölçüm ekle", "Beslenme raporunu indir"); "Hedef Düzenle" → Profil › Hedefim + ana sayfa halka/çip dokunuşu.
Yeniden giydirilen (Final'de yok): Su hızlı ekleme toast'ı, elle giriş sheet'i, eksik besin arama sheet'i, paylaşım kartı modalı, tabak detayında öğün döngüsü.

## Bayrak kapalı = bugünkü uygulama
- `TrackerScreen.flagOff` snapshot `3a52f64` üzerinde DEĞİŞMEDEN geçti (1/1); yeni her dal `yeniKabuk` (ve `su_takibi`) arkasında; eski Modal `visible={!yeniKabuk && …}` → kapalıyken aynı değer.
- `ScanFrame` renk/ölçü prop'ları isteğe bağlı (verilmezse eski beyaz 260); `captureOnce` kapalıyken aynı `Alert`.
- AppText ağırlık eşlemesi ve EmptyErrorCard başlık rengi yalnız yeni tasarım bileşenlerini etkiler; bunları kullanan `SharedPostScreen` `main`'de (1.0.7) yok.
- KİMSE: `git diff night14/visual` içinde sipariş/ödeme/adres mantığı, auth, package.json, app.config.js YOK.

## Kontrol (`3a52f64`)
| Kontrol | Sonuç |
|---|---|
| `npx tsc --noEmit` | 0 |
| `npm run test:unit` | 536/536 (yeni: `gun/__tests__/g15water.test.ts` 6, `ai/scan/__tests__/g15match.test.ts` 2) |
| `npm run test:components` | 92/92, 22 süit, snapshot 1/1 (yeni: `ai/scan/__component_tests__/FinPhotoResult.test.tsx` 2; flagOn testine eski bölüm iddiaları) |
| `npx expo export --platform ios` | ✓ Hermes 9.34 MB |

## ENTEGRASYONA (başka alanların dosyalarında küçük değişiklik)
- `src/modules/profil/ui/screens/FinPrProfileScreen.tsx` (S4): koleksiyon satırı → kart varken `ProfileCollectionRow` şeridi + "Koleksiyonuna eklendi · Gör" toast'ı (bir kez; `markWon`).
- `src/modules/profil/ui/screens/CollectionScreen.tsx`: ızgara → `CollectionCardDetail` + `relogCard`.
- `src/modules/shell/TabBarR3.tsx`: etiketlerde `maxFontSizeMultiplier={1}`.
- `src/navigation/AppNavigator.tsx`: R3'te `StatusBar` + sahne zemini temadan.
- `src/core/design/components/AppText.tsx` (+ index): `withWeightFamily`, `TextScaleCapContext`; `EmptyErrorCard` başlık mürekkep.
- `src/components/icons.ts`: `CameraSlash`, `Export`, `CalendarPlus`, `BookmarkSimple`. `src/core/flags/registry.ts`: `su_takibi`.
- Vitrin (paylaşılan dev dosyaları): katalog eşlemeleri, fixtures, `vitrinStress.tsx` (+ `.gitignore` istisnası).
- G15-S6: migration `20261106000100_g15_water.sql` G6-APPLY sırasına **#18**.
- S5: eatkcal `money()` biçimi Final'de "₺12.345,50".

## SORULAR
1. **Su hızlı ekleme**: Final'de ayrı pano yok. Su halkasına dokun = +250 ml + "Geri al". Uygun mu?
2. **Flaş (FinScanR2)**: canlı kamera için `expo-camera` gerekli (yeni paket yasak). Flaş düğmesi şimdilik "Flaşı kamerada açabilirsin" bilgisini gösteriyor; sistem kamerasının flaşı çalışıyor.
3. **"Planıma ekle"**: uygulamada plan ekranı yok (Final listesinde de yok) → yarın aynı saatte yerel "Planındaki öğün" hatırlatması kuruyor. Gerçek plan özelliği Dalga 2'de mi? **"Bu öğünü kaydet"** → tabak koleksiyonu (yerel).
4. **"Nedenin: …" (FinCelebStreak3/7)**: onboarding'de "neden" sorusu yok → satır gizli; soru eklenecek mi?
5. **FinErrFailed "Tekrar dene"**: metin "baştan çekmen gerekmez" diyor; akış vizöre dönüyor (aynı fotoğrafla yeniden analizde idempotency davranışı netleşmeden değiştirmedim).
6. **FinCollectEntry / FinPrProfile çakışması**: iki pano farklı profil gövdesi gösteriyor; FinPrProfile (S4) esas alındı.
7. **FinStressXL notu**: "En büyük boyutta sekme etiketleri gizlenir" diyor; FinHomeXL'de etiketler görünüyor. Etiketleri sabit boyutta gösterdim (kırpılmıyor).
8. **Koleksiyon verisi**: kartlar hâlâ yerel atamalardan (Dalga 2'de sunucu) → canlıda şerit çoğu kullanıcıda görünmez (düz "Koleksiyon" satırı kalır).

## İlter'e
- Simülatör: "G15-2 iPhone" (`E331640E-2AD1-419E-A44C-D89D5BB1782C`, G14 kopyası) — iş bitince kapatıldı; silmek için `xcrun simctl delete E331640E-2AD1-419E-A44C-D89D5BB1782C`.
- Görüntüler: `.claude/worktrees/g15-s2/.claude/night/out/g14/{g15s2,pair-g15s2}/` (git'e girmez).
- Telefonda deneme: bayraklar `yeni_kabuk` + `su_takibi` açık; su için migration önce staging'e uygulanmalı (bu oturumda uygulanmadı).
