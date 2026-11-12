# G22-S1 — Sesle ekleme + kcalAI abonelikleri + sunucuda günlük haklar (10 Kas)

Dal `night22/sub` (taban `night21/fix` @ 32e9e06), worktree `.claude/worktrees/g22-s1`.
Yalnız dosya: deploy YOK, migration UYGULANMADI, canlı DB yazma YOK, mağaza/EAS YOK.

## ÖZET
1. **Ses modu**: Tara mod çubuğu Fotoğraf · Ses · Barkod · Elle; FinScanVoice tüm hâller (hazır, izin, dinliyor, durduruldu, analiz, duyulmadı, izin kapalı, çevrimdışı, hak bitti + analiz hatası); telefonun konuşma tanıması (expo-speech-recognition, cihaz dili TR/EN, destekliyorsa cihazda), canlı döküm, "Bitti" → `analyze-ai-scan` **metin kipi** → FinPhotoR1 `source=voice`. Hak fotoğrafla ortak. Çevrimdışı metin kuyruğa girer. Klavyeyle yaz aynı yoldan.
2. **Elle gir**: Ana sayfa elle giriş katmanı (Tara'daki "Elle gir" de buraya açılır) artık aşağıdan kaymıyor; zemin 0→0,4 + katman opaklık 0→1, ölçek 0,96→1 (base 300 enter), kapanış tersi (fast 200 exit), azaltılmışta yalnız opaklık.
3. **Abonelik altyapısı**: migration (user_entitlements, kademeli reserve_ai_scan, reserve_barcode_scan, my_entitlement, app_settings, `abonelik` bayrağı) + rollback; `revenuecat-webhook` edge dosyası; istemcide RevenueCat (anahtar/modül yoksa girişler gizli, çökme yok).
4. **Ekranlar**: FinSubPaywall (kart dizisi ölçek/opaklık/snap/haptik, özellik şeridi 3 sn + duraklat, VoiceOver tek ayarlanabilir öğe), FinSubResult (başarı/iptal/bekliyor/hata), FinSubLimitAI/Barcode, FinSubPill, Profil › Abonelik + Yakında satırları.
5. **Barkod + AI izni**: AI izin sheet'i artık açılışta değil, yalnız Foto/Ses analizinden önce (onaydan sonra bekleyen çekim/analiz sürer); barkod ve elle izinsiz. Barkodda günlük hak `reserve_barcode_scan`.
6. **Restoran puanı**: `restaurant_rating(branch_id)` (son 90 gün, <10 → is_new); istemci mağaza başlığı, ürün sayfası, mağaza kartı ve FinEkReviews özetinde ("son 3 ay, N değerlendirme" / "Yeni").
7. **Kontroller**: tsc 0 · hygiene OK · unit 943/944 (1 eski atlanan) · jest 58 suite / 344 test · PGlite SQL 38/38 · deno check 2 fonksiyon temiz · `expo export` iOS + Android geçti · UI'da "₺" 0 · HIG kod denetimi (aşağıda).

## Commit tablosu
| Commit | Konu |
| --- | --- |
| 9350cac | Paketler: expo-speech-recognition ~3.1.3 (sdk-54 etiketi), react-native-purchases ~10.16.0 |
| 920c416 | Migration + rollback: abonelik/haklar (20261110100100), restoran puanı (20261110100200); PGlite kontrolü |
| 56fe446 | revenuecat-webhook edge dosyası + saf eşleme; analyze-ai-scan `mode:'text'` |
| 205873d | İstemci abonelik altyapısı (RevenueCat, my_entitlement doğrulaması, saf plan/hak mantığı, sözlükler) |
| f0e14f1 | Ses modu + mod çubuğu + FinPhotoR1 ses kipi; abonelik ekranları; AI izni yalnız analizden önce; barkod hakkı |
| e378c54 | İzinler: app.config (konuşma tanıma + mikrofon metni TR/EN, Android RECORD_AUDIO) |
| c267353 | Elle gir belirme geçişi + restoran puanı istemcisi |
| d576f33 | Testler + bekçi testlerinin yeni dosyalarla güncellenmesi |
| dbafa11 | HIG: paywall kart bandı Dynamic Type |

## KARAR
- **Paket sürümleri**: `expo install` en yeni expo-speech-recognition'ı (58.x = Expo SDK 58) seçti; projede SDK 54 var → paketin `sdk-54` etiketi **3.1.3** kullanıldı. react-native-purchases 11.0.0 çok yeni (28 Eki) → olgun **10.16.0** (RN ≥ 0.73) seçildi.
- **Ses verisi**: ses sunucumuza gitmez; tanıma cihaz destekliyorsa cihazda (`requiresOnDeviceRecognition`), desteklemiyorsa işletim sisteminin konuşma hizmeti (Apple/Google). Analize yalnız metin (≤ 500 karakter) gider. Kayıt `meal_consumptions.source = 'ai_scan'` (yeni CHECK değeri istememek için), `source_ref` = `voice-…` ile ayrışır.
- **Ses sonucu başlığı**: tasarımda sol geri oku var; Tara modal olduğu için gezinme kuralı (G17 md.7, testle zorunlu) gereği **kapat X sağda** (foto sonucu ile aynı).
- **Puan metni**: istenen "son 3 ay · N değerlendirme" yerine **"son 3 ay, N değerlendirme"** — Final sözlüğünde dekoratif " · " yasak (G17 md.9 testi).
- **Puan ortalaması**: verilen tüm yıldızlar (is_approved yorum METNİNİN moderasyonu). Mağaza ekranı marka bazlı ve istemcide seçili şube yok → `restaurant_rating(null)` = tüm şubeler; şube kimliği verilirse şube bazlı çalışır.
- **Alt boyutlar** (lezzet/teslimat/kalori uyumu): canlı şemada (`CANLI_SEMA_2026-11-09.md`) `reviews` yalnız `rating` taşıyor → RPC NULL döner, istemci çizmez.
- **Barkod hakkı**: ürün BULUNDUKTAN sonra sayılır (bulunamayan barkod hak yemez); aynı gün aynı barkod bir kez sayılır. RPC yoksa/ağ hatasında **izin verilir** (fail-open). Ücretli kademede barkod sınırsız kuralı kodda (sayı değil); sayılar app_settings'te.
- **Balance adil kullanım**: tavan dolunca `reason:'fair_use'` → hak sheet'i "adil kullanım sınırı" metniyle, plan önermeden.
- **Webhook**: CANCELLATION kademeyi dönem sonuna kadar korur (will_renew=false); PRODUCT_CHANGE yükseltmeyi hemen, düşürmeyi bir sonraki RENEWAL'da uygular; sırasız/tekrar olay yok sayılır; anonim RevenueCat kimliği yok sayılır; sandbox olayları da işlenir (TestFlight/App Review).
- **Fiyat biçimi**: TRY fiyatı ortak biçimlendiriciden (₺ yok, binlik nokta yok: "1799 TL"; tasarımda "1.799 TL"). Diğer para birimleri mağazanın yerel dizesi.
- **Abonelik kapalıyken** (bayrak ya da anahtar yok): hak dolunca mevcut FinErrLimit (parite; başlık artık sunucu tavanıyla); barkod hak sheet'i plan/karo olmadan; Ses hak sheet'i "Elle gir". Profil satırları gizli.
- **Paywall görselleri**: `assets/glass/camera.png`, `mic.png`, `barcode.png`, `infinity.png` mevcut cam nesnelerin KOPYASI olarak eklendi (kase/damla/alev/kupa); İlter'in dosyaları gelince yalnız üzerine kopyalanacak, kod değişmez.
- **Sürüm**: `app.config` sürümü 1.1.0 bırakıldı (G20-S2 kararı); bayrak `min_app_version = 1.2.0`.

## CANLIYA UYGULANACAK (sırayla)
1. `supabase/migrations/20261110100100_g22_s1_subscriptions.sql` (önkoşul: 20261109190100 G19 sertleştirme). **Etkisi**: ücretsiz AI hakkı 3 → **2** olur (ai_daily_free). Uygulamadan önce kontrol: `select key, value from app_settings where key like 'ai_daily_%' or key = 'barcode_daily_free';`
2. `supabase/migrations/20261110100200_g22_s1_restaurant_rating.sql`.
3. Secret: `REVENUECAT_WEBHOOK_SECRET` (Supabase › Edge Functions › Secrets) — değer yalnız RevenueCat'e girilir.
4. Bayrak `abonelik` İlter açar (anahtarlar + yeni derleme + webhook hazır olunca).
Geri alma: `supabase/rollbacks/20261110100100_…_rollback.sql` (user_entitlements silinir — önce satır sayısı), `…100200_…_rollback.sql`.

## DEPLOY / YENİ DERLEME
- Edge deploy: `analyze-ai-scan` (metin kipi; migration ÖNCE değil, bağımsız — eski istemci etkilenmez), `revenuecat-webhook` (`--no-verify-jwt`; çağıran RevenueCat).
- **Yeni native derleme gerekir** (expo-speech-recognition, react-native-purchases, yeni izinler). Bayrak `min_app_version 1.2.0` → derleme 1.2.0 olmalı ya da bayrağın min sürümü derleme sürümüne çekilmeli. OTA güvenli: native modül yoksa Ses sekmesi gizli, abonelik kullanılamaz (çökme yok).
- Gizlilik: App Store gizlilik etiketi/manifest — ses verisi toplanmıyor (cihazda metne çevrilir); metin "Other User Content" kapsamında zaten beyanlı (G3-S1). Gizlilik Politikası'na "sesli giriş: ses saklanmaz, yalnız yazıya dökülen metin kalori tahmini için hizmet sağlayıcıya gönderilir" cümlesi eklenmeli (hukuk metni İlter'de).

## İLTER YAPACAK
- EAS env (production + preview): `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (RevenueCat › Project › API keys › public SDK key; gizli anahtar DEĞİL).
- RevenueCat: ürünler `kcalai_fresh_monthly/yearly`, `kcalai_balance_monthly/yearly`; yetkiler `fresh`, `balance`; teklif `default` (4 paket); yıllıklarda 7 gün deneme mağazada.
- RevenueCat › Integrations › Webhooks: URL `https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/revenuecat-webhook`, Authorization değeri = `REVENUECAT_WEBHOOK_SECRET`.
- App Store Connect / Play Console abonelik grupları + fiyatlar; App Review notu (deneme + geri yükle).
- Paywall cam görselleri (mic/camera/barcode/infinity.png) → `assets/glass/` üzerine kopya.

## HIG (apple-design-skill, kod denetimi kipi)
Kaynak: `accessibility.md` (44x44 pt), `apple-in-app-purchase.md › Auto-renewable subscriptions`, `motion.md › Make motion optional`.
- ✓ Dokunma: mikrofon 80, klavye/Bitti/İptal 52, kapat 44, mod sekmeleri ≥ 44, duraklat 44, bağlantılar ≥ 44, hak hapı ≥ 44.
- ✓ Abonelik ekranı: "The subscription name, duration… The billing amount, correctly localized… A way… to restore purchases" — ad/süre/yerel fiyat her kartta, geri yükle, Koşullar/Gizlilik, otomatik yenileme metni; "Clearly describe how a free trial works" — "7 gün ücretsiz, sonra 1799 TL/yıl. Ücret deneme bitince alınır."
- ✓ VoiceOver: kart dizisi tek `adjustable` öğe ("Balance Yıllık, 1799 TL, 7 gün ücretsiz, 4/4"), artır/azalt; dalga `image` + etiket; mikrofon "Kaydı başlat/durdur"; sheet'ler `accessibilityViewIsModal`.
- ✓ Azaltılmış hareket: dalga sabit, halka sabit, kart ölçeği 1, şerit otomatik geçişi kapalı, sheet/elle gir yalnız opaklık.
- ✓ Kontrast: lime #C6F04F üzerinde #0A0A0A (~15:1); ikincil #6B6B70 / #F3F4F6 ≈ 4,8:1.
- Düzeltildi: paywall kart bandı büyük yazıda kırpılıyordu (sabit yükseklik) → minHeight + 2 satır.
- Düşük: hak sheet karoları ve ses çipleri 1–2 satırla sınırlı (en büyük Dynamic Type'ta "…" olabilir). iOS'ta `accessibilityLiveRegion` yok — canlı döküm VoiceOver'a otomatik okunmaz (Android okur).

## SORULAR
1. Ücretsiz AI hakkı migration ile **3 → 2** iniyor (İlter kararı). Mevcut "Bugünkü 3 taramanı kullandın" metni artık sunucu tavanıyla yazılıyor; eski (bayrak kapalı) kabuk `ScanLimitSheet` hâlâ sabit "3" diyor — eski kabuk kapatılacağı için dokunulmadı. Uygun mu?
2. AI izin sheet'inin metni yalnız fotoğraftan söz ediyor ("Tabak fotoğrafın… gönderilir"); ses de aynı izinle soruluyor. Metnin "fotoğraf ve sesli girişin metni" diye güncellenmesi (yeni rıza sürümü) hukuki karar — İlter?
3. Ses sonucu başlığı: tasarımdaki sol geri oku yerine gezinme kuralı gereği sağda X. Tasarım güncellensin mi, kural mı esnesin?
4. Puan metninde "·" yerine virgül (G17 md.9). "·" isteniyorsa G17 testine istisna eklenmeli.
5. Fiyat biçimi "1799 TL" (ortak biçim, binlik nokta yok) — tasarım "1.799 TL" gösteriyor. Abonelik ekranında binlik ayraç istenir mi?
6. Restoran puanında tüm şubeler birleşik (mağaza marka bazlı). Şube bazlı isteniyorsa istemciye "seçili şube" kavramı gerekir.
7. Barkod hakkı yalnız BULUNAN ürünlerde sayılıyor; bulunamayanlar ücretsiz. Doğru mu?
8. Cihaz ekranında (simülatör/telefon) görsel karşılaştırma (SSIM) yapılmadı: yeni native modüller derleme istiyor ve iOS derlemesi yalnız G18-S5'e izinli (GECE19-ORTAK). Yeni derlemeden sonra FinScanVoice/FinSub* ekranlarının birebir çekim karşılaştırması gerekir.
