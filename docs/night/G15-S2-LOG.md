# G15-S2 — Ana sayfa + Su + Tara + Gün + Kutlama (opus)

## ÖZET (10 satır)
(1) Dal `night15/home` (taban `night14/visual` `a1fe71f`), worktree `.claude/worktrees/g15-s2`, simülatör kopyası "G15-2 iPhone" (`E331640E-…782C`), Metro `--port 8092`. 10 commit, 45 dosya.
(2) Su takibi: migration DOSYASI `supabase/migrations/20261106000100_g15_water.sql` (water_daily, RLS yalnız sahibi, `log_water(ml)`, `su_takibi` satırı kapalı/1.1.0) + rollback; canlıya UYGULANMADI. Bayrak `su_takibi` (registry false). Ana sayfada Final Su halkası; dokun = +250 ml + "Geri al" toast.
(3) Ana sayfa: Enerji 92 / Protein 64 / Su 64 halkalar, boş günde "İlk öğününü logla", Final makro çipleri, eatkcal yatay şeridi + Keşfet video şeridi (gerçek veri, yoksa gizli), teslim anı (kase + "Akşam’a loglandı · Geri al · Gör"), satır içi porsiyon + Kaldır, Akşam damla işareti (bekleyen log).
(4) Koyu tema: R3 kabukta durum çubuğu temadan, eski "Kalori Ekle" modalı → Final elle giriş sheet'i, eski Makrolar/Su kartı yalnız bayrak kapalı, yükleniyor/hata Final, cam nesnenin koyu temadaki gri karesi giderildi.
(5) XL/EN: AppText `fontWeight` → doğru Jakarta/Bricolage dosyası (sistematik: "kalın" metinler ince çıkıyordu), ana sayfa 1.3× tavan, sekme etiketleri kırpılmıyor; EN "50%", porsiyon "0.5/1.5", "Explore/See all".
(6) Tara: FinScanR2 vizörü (alt mod çubuğu, lime deklanşör, hak hapı, flaş), FinPhotoR1 foto + makro sheet (halka⇄çubuk, gram alanı, eksik besin arama, Geri al/Gör), "Kameraya erişim kapalı" ayrı durum + Final hata sayfaları.
(7) Gün/kutlama/koleksiyon: görüntüleyici "+ Öğle’ye logla" + özet slaytları (vitrinSlide), kutlama vurgu/alev/Export, "Kart kazandın" Final, tabak detayı + Tekrar logla, tek tabak kompakt sonuç, profilde koleksiyon şeridi; stres panoları için gerçek bileşenli kabul sahnesi.
(8) Pano tablosu: 56 görüntü → önce (G14) aynı 0 · küçük 15 · büyük 39 · ekran yok 2 → sonra küçük fark 56 (4'ü yıldızlı: veri/özellik yok, SORULAR). `Eski tasarım: 0`.
(9) Kontrol: tsc 0 · test:unit 534/534 · test:components 90/90 (flagOff snapshot aynı) · `expo export --platform ios` ✓ (9.31 MB) · KİMSE diff boş.
(10) Son commit GERÇEK dosya `docs/night/G15-S2-DONE`. SORULAR: 10 madde.

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

## Pano tablosu (önce G14 → sonra G15)
Yöntem: `scripts/dev/g14-shots.sh` (UDID/OUT değişkenli) → `G14_SET=g15s2 npx tsx scripts/dev/g14-pair.ts` → Final (sol) | uygulama (sağ) çiftleri 2 paralel görsel incelemeyle + kendi incelemem; çekim hatası (yanlış ekran) çıkan 15 pano yeniden çekilip doğrulandı. Çiftler: `.claude/worktrees/g15-s2/.claude/night/out/g14/pair-g15s2/`.
Kabul edilen veri farkları (tabloda tekrar yazılmadı): mock yemek fotoğrafı yok (gri/koyu yer tutucu), vitrin kullanıcı adı "Deniz" (Final "İlter"), Final'deki `[N]` yer tutucuları yerine gerçek sayılar, Final'in kesik çizgili spec etiketleri/"Reduced motion" anahtarı.

| Pano | Önce (G14) | Sonra (G15) | Kalan farklar |
|---|---|---|---|
| FinHomeR3 | büyük fark | küçük fark | porsiyon satırında ek Paylaş ikonu (paylasim_karti); alt bölümler görünüm dışında |
| FinHomeR3-Dark | küçük fark | küçük fark | aynı |
| FinHomeEmptyR1 | büyük fark | küçük fark | damla/halka ölçüsü birkaç pt |
| FinHomeEmptyR1-Dark | büyük fark | küçük fark | damla hale ışığı biraz görünür |
| FinHomeDelivered | büyük fark | küçük fark | halka teslim edilen öğünü saymış (%73; Final halka sayılmadan önceki an %50) |
| FinHomeDelivered-Dark | büyük fark | küçük fark | aynı |
| FinHomeEN | büyük fark | küçük fark | ölçü |
| FinHomeEN-Dark | küçük fark | küçük fark | ölçü |
| FinHomeXL | büyük fark | küçük fark | en büyük yazıda "560 kcal" saatle hafif yakın (Final'de de) |
| FinHomeXL-Dark | küçük fark | küçük fark | aynı |
| FinHomeLogBefore | büyük fark | küçük fark | damla şekli (goo yerine tek path); spec etiketi |
| FinHomeLogBefore-Dark | büyük fark | küçük fark | aynı |
| FinHomeLogFlow | büyük fark | küçük fark | akış çizgisi hareket karesi (LogTrail anlık) |
| FinHomeLogFlow-Dark | büyük fark | küçük fark | aynı |
| FinHomeLogMerged | büyük fark | küçük fark | ölçü |
| FinHomeLogMerged-Dark | büyük fark | küçük fark | ölçü |
| FinAddSheet | büyük fark | küçük fark | arka plan Keşfet başlığı yerine örnek gönderi (vitrin zemini); ürün görseli yerine baş harf |
| FinAddSheet-Dark | büyük fark | küçük fark | aynı |
| FinScanR2 | büyük fark | küçük fark | "Kamera görüntüsü" yer tutucu metni yok (gerçek önizleme yok, sistem kamerası) |
| FinScanR2-Dark | büyük fark | küçük fark | aynı |
| FinPhotoR1 | büyük fark | küçük fark* | *"Planıma ekle" / "Bu öğünü kaydet" yok (uygulamada özellik yok → SORULAR 3) |
| FinPhotoR1-Dark | büyük fark | küçük fark* | aynı |
| FinPhotoEN | büyük fark | küçük fark* | aynı |
| FinPhotoEN-Dark | büyük fark | küçük fark* | aynı |
| FinScanError | büyük fark | küçük fark | sheet yüksekliği birkaç pt |
| FinScanError-Dark | büyük fark | küçük fark | aynı |
| FinErrFailed | küçük fark | küçük fark | not hapı tek satır |
| FinErrFailed-Dark | küçük fark | küçük fark | aynı |
| FinErrOffline | küçük fark | küçük fark | wifi ikon çizgisi |
| FinErrOffline-Dark | küçük fark | küçük fark | aynı |
| FinErrLimit | küçük fark | küçük fark | saat ikonu çizgisi, başlık 1–2 pt |
| FinErrLimit-Dark | küçük fark | küçük fark | aynı |
| FinGunView | büyük fark | küçük fark | foto yok (koyu zemin) |
| FinGunView-Dark | büyük fark | küçük fark | aynı |
| FinGunEnd | büyük fark | küçük fark | küçük resimler boş; sıra Kahvaltı/Öğle/Akşam (Final Öğle/Akşam/Kahvaltı) |
| FinGunEnd-Dark | büyük fark | küçük fark | aynı |
| FinGunDone | büyük fark | küçük fark | aynı |
| FinGunDone-Dark | büyük fark | küçük fark | aynı |
| FinCelebrate | küçük fark | küçük fark | dekor "+" işaretleri yok, alev hale |
| FinCelebrate-Dark | küçük fark | küçük fark | aynı |
| FinCelebStreak3 | küçük fark | küçük fark | "Nedenin: …" satırı yok (veri yok → SORULAR 5) |
| FinCelebStreak3-Dark | küçük fark | küçük fark | aynı |
| FinCelebStreak7 | küçük fark | küçük fark | aynı (kupa → alev düzeltildi) |
| FinCelebStreak7-Dark | küçük fark | küçük fark | aynı |
| FinCollectCut | büyük fark | küçük fark* | *eşleşme yüzdesi ("%92 eşleşme") verisi yok → hapta yalnız ad (SORULAR 7) |
| FinCollectCut-Dark | büyük fark | küçük fark* | aynı |
| FinCollectWon | büyük fark | küçük fark | "Lifli" etiketi yok (lif verisi yok); bulanık foto zemini yok |
| FinCollectWon-Dark | büyük fark | küçük fark | aynı; kart koyu |
| FinCollectGrid | büyük fark | küçük fark | detay tam ekran (Final'de altta sekme çubuğu) |
| FinCollectGrid-Dark | ekran yok | küçük fark | aynı |
| FinCollectEntry | büyük fark | küçük fark* | *koleksiyon şeridi Final'le aynı; çevresindeki profil gövdesi FinPrProfile'a göre (S4 alanı), "Koleksiyonuna eklendi" toast'ı yok (SORULAR 8) |
| FinCollectEntry-Dark | büyük fark | küçük fark* | aynı |
| FinStressLong | büyük fark | küçük fark | para biçimi eatkcal'ın `money()`'si ("12345.50 TL"; Final "₺12.345,50" — S5, ENTEGRASYONA) |
| FinStressXL | büyük fark | küçük fark | sekme çubuğu bölümü sahnede yok (kabuk ayrı test) |
| FinStressEN | büyük fark | küçük fark | Profil satırları bölümü sahnede yok |
| FinStressDark | ekran yok | küçük fark | seçili öğün çipi mürekkep (Final lime) |

Dağılım: önce aynı 0 · küçük fark 15 · büyük fark 39 · ekran yok 2 → sonra küçük fark 56 (yıldızlı 8 görüntü / 4 pano: Final'deki öğe için uygulamada veri/özellik yok; uydurulmadı).

## Eski tasarım: 0
Bayraklar açık (FINAL_FLAGS + `su_takibi`), alan: Ana sayfa, Tara, Gün, kutlama, öğün ekleme/düzenleme. Taranan ve Final'e taşınan/giydirilen (önce → sonra):
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
13. Kutlama ince vurgu, ShareNetwork, büyük alev → Final.
14. "Kart kazandın" ortalı/yan yana/görünmez Paylaş → Final.
15. Koleksiyon ızgarasından "Kart kazandın" açılması → tabak detayı.
16. Hata kartı başlığı kırmızı → mürekkep (Final).
Kalan: yok. (Ana sayfa kayıt silme hatasında sistem `Alert` — iOS sistem diyaloğu, tasarım bileşeni değil.)

Taşınan (Final karşılığı var; G14'te yeni kabuktan kaldırılmıştı): Geçmiş, Özet/Grafik, tarih hapları (Bugün/Dün/7/14/30) → Profil › İlerleme (FinPrProgress: gün çipleri, kalori grafiği, hedef/makro uyumu, makro dağılımı, ölçümler + "Ölçüm ekle", "Beslenme raporunu indir"); "Hedef Düzenle" → Profil › Hedefim "Hedefi düzenle" + ana sayfa halka/çip dokunuşu.
Yeniden giydirilen (Final'de yok): Su hızlı ekleme toast'ı, elle giriş sheet'i, eksik besin arama sheet'i, paylaşım kartı modalı, tabak detayında "Tekrar logla" öğün döngüsü.

## Bayrak kapalı = bugünkü uygulama
- `TrackerScreen.flagOff` snapshot DEĞİŞMEDEN geçti; yeni her dal `yeniKabuk` (ve `su_takibi`) arkasında; eski Modal `visible={!yeniKabuk && …}` → kapalıyken aynı değer.
- `ScanFrame` renk/ölçü prop'ları isteğe bağlı (verilmezse eski beyaz 260); `captureOnce` kapalıyken aynı `Alert`.
- AppText ağırlık eşlemesi yalnız AppText kullanan (yeni tasarım) ekranları etkiler; AppText kullanan `SharedPostScreen` `main`'de (1.0.7) yok.
- KİMSE: `git diff night14/visual` içinde sipariş/ödeme/adres mantığı, auth, package.json, app.config.js YOK.

## Kontrol (`7b05e61`)
| Kontrol | Sonuç |
|---|---|
| `npx tsc --noEmit` | 0 |
| `npm run test:unit` | 534/534 (yeni `src/modules/gun/__tests__/g15water.test.ts` 6/6: biçim, gün, bayrak kapalı, migration içeriği) |
| `npm run test:components` | 90/90, 21 süit, snapshot 1/1 (flagOn testine eski bölüm yok + Su halkası iddiaları eklendi) |
| `npx expo export --platform ios` | ✓ Hermes 9.31 MB |

## ENTEGRASYONA (başka alanların dosyalarında küçük değişiklik)
- `src/modules/profil/ui/screens/FinPrProfileScreen.tsx` (S4): koleksiyon satırı → kart varken `ProfileCollectionRow` şeridi (+ `loadCollection`).
- `src/modules/profil/ui/screens/CollectionScreen.tsx`: ızgara → `CollectionCardDetail` + `relogCard`.
- `src/modules/shell/TabBarR3.tsx`: etiketlerde `maxFontSizeMultiplier={1}`.
- `src/navigation/AppNavigator.tsx`: R3'te `StatusBar` + sahne zemini temadan.
- `src/core/design/components/AppText.tsx` (+ index): `withWeightFamily`, `TextScaleCapContext`; `EmptyErrorCard` başlık mürekkep.
- `src/components/icons.ts`: `CameraSlash`, `Export` dışa aktarımı. `src/core/flags/registry.ts`: `su_takibi`.
- Vitrin (paylaşılan dev dosyaları): katalog eşlemeleri, fixtures, `vitrinStress.tsx` (+ `.gitignore` istisnası).
- G15-S6: migration `20261106000100_g15_water.sql` G6-APPLY sırasına **#18**.
- S5: eatkcal `money()` biçimi Final'de "₺12.345,50" (FinStressLong).

## SORULAR
1. **Su hızlı ekleme**: Final'de ayrı pano yok. Su halkasına dokun = +250 ml + "Geri al" toast. Uygun mu, yoksa ayrı bir su sheet'i mi?
2. **Flaş (FinScanR2)**: canlı kamera için `expo-camera` gerekli (yeni paket yasak). Flaş düğmesi şimdilik "Flaşı kamerada açabilirsin" bilgisini gösteriyor; sistem kamerasının flaşı çalışıyor.
3. **"Planıma ekle" / "Bu öğünü kaydet" (FinPhotoR1/EN)**: uygulamada plan ve kayıtlı öğün özelliği yok → işlevsiz düğme koymadım. Dalga 2 mi?
4. **Barkod modu**: önceden de işlevsiz; Final'deki gibi görünüyor ama dokunuşu yok.
5. **"Nedenin: …" (FinCelebStreak3/7)**: onboarding'de "neden" sorusu yok → veri yok, satır gizli.
6. **FinErrFailed "Tekrar dene"**: metin "baştan çekmen gerekmez" diyor; akış vizöre dönüyor (aynı fotoğrafla yeniden analizde idempotency davranışı netleşmeden değiştirmedim).
7. **Eşleşme yüzdesi (FinCollectCut "%92 eşleşme")**: tarama sonucunda yok → hapta yalnız tabak adı.
8. **FinCollectEntry**: pano eski bir profil düzeni gösteriyor (FinPrProfile ile çelişiyor); şerit eklendi, profil gövdesi FinPrProfile'da kaldı. "Koleksiyonuna eklendi" toast'ı ne zaman çıksın (kart kazanınca profil dışında)?
9. **FinStressXL notu**: "En büyük boyutta sekme etiketleri gizlenir" diyor; FinHomeXL'de ise etiketler görünüyor. Etiketleri sabit boyutta gösterdim (kırpılmıyor). Hangisi?
10. **Koleksiyon verisi**: kartlar hâlâ yerel atamalardan (Dalga 2'de sunucu) → canlıda şerit çoğu kullanıcıda görünmez (düz "Koleksiyon" satırı kalır).

## İlter'e
- Simülatör: "G15-2 iPhone" (`E331640E-2AD1-419E-A44C-D89D5BB1782C`, G14 kopyası) — iş bitince kapatıldı; silmek için `xcrun simctl delete E331640E-2AD1-419E-A44C-D89D5BB1782C`.
- Görüntüler: `.claude/worktrees/g15-s2/.claude/night/out/g14/{g15s2,pair-g15s2}/` (git'e girmez).
- Telefonda deneme: bayraklar `yeni_kabuk` + `su_takibi` açık; su için migration önce staging'e uygulanmalı (bu oturumda uygulanmadı).
