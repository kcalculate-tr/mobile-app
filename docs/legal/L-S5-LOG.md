# L-S5 LOG: kişisel plan / öğün planı rıza metinleri (12 Kasım 2026)

Dal `legal/global` · worktree `.claude/worktrees/l-s3`. Başlangıçta `git merge --no-ff release/1.1.0` (8d69e79). **Kod değişikliği yok** (`git diff release/1.1.0..HEAD -- . ':!docs'` boş) · **deploy yok** · push yalnız `legal/global`.

## ÖZET
1. `L-S5-RIZA-METINLERI.md`: dört rıza için TR + EN kısa ekran metni (≤ 2 cümle) ve "Aydınlatma metni" uzun metni. 1a sağlık verisi, 1b alerji (ayrı), 1c Koç paylaşımı değerlendirmesi, 1d takip kapısı ve abonelik teklifi için 12 zorunlu ifade.
2. Kişisel plan verisi **ABD'ye gitmiyor**. Hesap telefonda yapılıyor, veri Supabase'te (AB) saklanıyor. Metin bunu açıkça söylüyor; AB'de saklamanın da KVKK md.9 aktarımı olduğu yazıldı.
3. **Kritik bulgu (K-1):** Balance "Koç'la oluştur" alerjen adlarını, diyeti ve kalori/protein hedefini Anthropic'e (ABD) **Koç izni sorulmadan** gönderiyor (`PlanGenerateScreen.tsx:166-169`, `meal-plan-generate/rank.ts:76-80`).
4. Koç'un kişisel plan özetini okuması onaylı Koç metninin (B-30) kapsamı dışında kalıyor (kilo hedefi, tempo, hedef tarihi). Öneri: Koç izni metni sürüm 2 (A seçeneği); ayrı rıza gerekmiyor.
5. Koddan çıkan diğer farklar: uygulamada sağlık/alerji rızasını geri alma yolu yok (K-2); 18 yaş altında cevaplar silinmiyor (K-3); kullanım ölçümü plan hedefini ve tartı sınıfını taşıyor (K-5); rıza satırına metin sürümü yazılmıyor (K-6).
6. Metinler ön koşullar **bittikten sonraki** davranışı anlatıyor. Yayın K-1…K-6'ya bağlı (README "Yayından önce" maddesi eklendi).
7. `L-S5-POLITIKA-EKLERI.md`: L-S4 metnine yamalar. Gizlilik GP-1…GP-12 (yeni §4A dâhil), KVKK KA-1…KA-5, Açık Rıza AR-1…AR-3 (yeni §8 alerji). "Adım sayısı işlemeyiz" çelişkisi düzeltildi.
8. `MAGAZA_GIZLILIK_ESLEME.md`: Apple Health/Fitness ve Play Health info/Fitness info satırları + yeni §5 (HealthKit yok, Sensitive Info değil, Analytics amacı K-5'e bağlı).
9. `L-S5-KOD-ESLEME.md`: 42 satırlık dosya:anahtar → yeni metin tablosu, ön koşullar K-1…K-6, metin dışı değişiklikler C-1…C-8.
10. "Sağlık notu" alanı kodda yok; metin "hastalık, ilaç, gebelik sormayız" diyor.

## Commit tablosu
| Commit | Madde |
|---|---|
| 8d69e79 | merge `release/1.1.0` → `legal/global` |
| c607445 | md.1 `L-S5-RIZA-METINLERI.md` |
| ac72c70 | md.2 `L-S5-POLITIKA-EKLERI.md` |
| 156c0bb | md.3 `MAGAZA_GIZLILIK_ESLEME.md` (+§5) |
| a8d637f | md.4 `L-S5-KOD-ESLEME.md` |
| (sonraki) | README + LOG · `docs/legal/L-S5-DONE` |

## KARAR (gece kuralı: en güvenli seçenek)
- Metinler **hedef davranışı** anlatıyor, her biri ⚑ ile ön koşula bağlandı. Bugünkü kodu anlatan metin yazmak, Koç'la oluştur'daki izinsiz aktarımı meşrulaştırmak olurdu.
- 1c: Koç plan özeti için **C (yalnız bilgilendirme)** reddedildi; öneri **A** (Koç izni v2). B-30 onaylı metni değiştirmek İlter onayına bırakıldı.
- Plan cevaplarının tümü (cinsiyet ve diyet dâhil) sağlık verisi rızası kapsamına alındı (temkinli; aynı amaçla birlikte işleniyor).
- Alerji filtresi metnine "tıbbi güvence değildir" uyarısı eklendi (ürün sorumluluğu).
- Açık Rıza sayfası görevde yoktu; uygulamadaki "Aydınlatma metni"nin web karşılığı olduğu için AR-1…AR-3 eklendi.
- `pw_legal` deneme olmayan teklifte de "Ücret deneme bitince alınır" diyor → iki anahtara ayrıldı; deneme süresi `%{days}` ile mağazadan.
- Mağaza: alerjen ve plan cevapları Apple **Health** (Sensitive Info değil), egzersiz/adım **Fitness**; Play **Health info** / **Fitness info**, "paylaşım değil", "isteğe bağlı".
- Madde numaraları (Mesafeli Söz. Yön., Ticari Reklam Yön., Apple 3.1.2, Play politikası) bilinen metinlerden verildi; 1d'de "İlter teyit etmeli" notu var.

## CANLIYA UYGULANACAK
Yok (DB/migration yok). K-2 ve K-6 ileride migration isteyebilir (CHECK kısıtları).

## DEPLOY GEREKİR
Hayır. Yayın sırası `L-S5-POLITIKA-EKLERI.md` §D: önce kod ön koşulları (ayrı oturum, OTA), sonra web metinleri (kcal-web `legal/web-1.1.0`), aynı gün mağaza konsolu.

## SORULAR (İlter)
1. **Ortak sağlık rızası (§1a-not):** Takibe başla rızası kişisel planın ek verilerini (ölçü, vücut yağı, egzersiz, diyet, oruç) kapsamıyor ama plan onu geçerli sayıyor. İki ekranda aynı yeni metin + `HEALTH_CONSENT_VERSION` 2 (eski onaylılara bir kez sorulur) mi, yoksa kişisel plan için ayrı anahtar mı?
2. **Koç izni sürüm 2 (§1c):** Önerilen metin onaylanıyor mu? Mevcut Koç kullanıcılarına yeniden sorulması kabul mü? (Alternatif B: ayrı "Koç planımı görsün" anahtarı.)
3. **K-1 acil mi?** Koç'la oluştur bugün izinsiz ABD aktarımı yapıyor. `kisisel_plan`/öğün planı bayrağı canlıda açıksa, metin beklemeden kod düzeltmesi (ayrı oturum, OTA) yapılsın mı?
4. **Takip kapısı (§1d.3):** Takibin sağlık verisi rızasına bağlanması "hizmet için gerekli veri" olarak savunulabilir göründü. Katılıyor musun? Kapı ekranı metni önerisi uygun mu?
5. **Ara kayıt süresi (GP-10):** Yarım kalan kişisel plan cevapları süresiz kalıyor. 90 gün sonra silme (sunucu işi) eklensin mi?
6. **Web Açık Rıza §1 kutu metni (AR-1 notu):** "Yurt dışındaki hizmet sağlayıcılara aktarılmasına" ifadesi kişisel plan için yanlış izlenim veriyor. Kutu metni AI tahmini / plan diye ayrıştırılsın mı?
7. **Takibe başla'da 18 yaş altı:** K-3 yalnız kişisel planı kapsıyor. Takibe başla'da 18 altı doğum yılı girilirse profil verisi ne oluyor? Ayrı inceleme (B-10 ile birlikte) gerekiyor.
8. **Play "İsteğe bağlı":** Takip kapısı takibi profile bağlıyor. Play inceleme "zorunlu" sayarsa Health info'yu "Zorunlu" işaretlemek kabul mü?
9. **Rıza kaydı ve hesap silme:** `delete-account` `user_consents` satırlarını CASCADE ile siliyor; Açık Rıza "ispat için 3 yıl saklanır" diyor. Hesap silmede rıza kaydı kimliksizleştirilerek tutulsun mu, yoksa metin mi değişsin?
10. **Cayma hakkı (Z-10, B-26):** Uygulama içi abonelikte ön bilgilendirmede "cayma hakkı yok" cümlesi gösterilsin mi? Satıcı sıfatı kararı hâlâ açık.
11. **Supabase bölgesi:** Metinler "AB'de barındırma" diyor; `VERI_ENVANTERI.md` bunun Dashboard'dan teyit edilmediğini not ediyor. Teyit edildi mi?
