# Ekran görüntüsü planı — App Store 6.9" + 6.5", Google Play telefon, TR + EN (G20-S2 md.4)

`claude/MAGAZA_GORSEL_BASLIKLARI_v1.md` proje dokümanı repoda ve makinede **bulunamadı** → başlıklar bu dosyada
**yeni öneri** (İlter/Design onayına). Kaynak: **gerçek uygulama ekranları**, G14 vitrini (`src/dev/screenCatalog.ts`,
yalnız `__DEV__`) üzerinden Final panosuyla eşleşen durumda ve mock veriyle. Tek kaynak: `scripts/store/captions.json`.

**Bu gece çekim YAPILMADI:** boş disk 12 GB < 20 GB kuralı (GECE19-ORTAK). Betik hazır ve kuru denendi (aşağıda).

## Kareler (sıra = mağazadaki sıra)
Konumlandırma sırası: **takip et** (1–3) → **üret** (4) → **paylaş** (5–6) → motivasyon (7) → eatkcal, ikincil (8).
İlk 3 kare arama sonuçlarında görünür → çekirdek değer (fotoğrafla tara) ilk karede.

| # | Kimlik | Vitrin panosu TR / EN | Final panosu (tasarım dayanağı) | Başlık TR | Alt satır TR | Başlık EN | Alt satır EN |
|---|---|---|---|---|---|---|---|
| 1 | `01-tara` | FinPhotoR1 / FinPhotoEN | FinPhotoR1 (Tara sonucu: kalem, gram, kcal, P/K/Y) | Tabağını çek, kalorisini gör | Yapay zekâ kalori ve makroları tahmin eder | Snap your plate, see calories | AI estimates calories and macros |
| 2 | `02-ana` | FinHomeR3 / FinHomeEN | FinHomeR3 (halkalar + sekme çubuğu) | Günün tek bakışta | Kalori, makro, su ve etkinlik | Your day at a glance | Calories, macros, water and activity |
| 3 | `03-gun` | FinTracker / FinTrackerEN | FinTracker (gün kaydı, öğün yuvaları) | Her öğün, saniyeler içinde | Fotoğrafla, elle ya da hızlı ekle | Every meal, in seconds | By photo, by hand or quick add |
| 4 | `04-uret` | FinCompose / FinComposeEN | FinCompose (öğün kartlı paylaşım) | Öğününü paylaşıma dönüştür | Kalori ve makrolarıyla birlikte | Turn your meal into a post | With calories and macros attached |
| 5 | `05-kesfet` | FinFeed / FinFeedEN | FinFeed (Keşfet akışı) | Topluluktan ilham al | Tarifler, öğünler, yorumlar | Get inspired by the community | Recipes, meals and comments |
| 6 | `06-tarif` | FinRecipe / FinRecipeEN | FinRecipe (tarif ayrıntısı + logla) | Gördüğünü gününe ekle | Tek dokunuşla logla | Add what you see to your day | Log it in one tap |
| 7 | `07-seri` | FinStreak / FinStreakEN | FinStreak (seri) | Serini büyüt | Her gün bir öğün yeter | Grow your streak | One meal a day keeps it going |
| 8 | `08-eatkcal` | FinEkHome / FinEkHomeEN | FinEkHome (eatkcal ana sayfa) | İzmir'deysen: eatkcal | Kalorisi belli sağlıklı öğünler kapında | In İzmir? Order with eatkcal | Healthy meals with known macros, delivered |

Kurallar: başlık ≤ 30 karakter, alt satır ≤ 45; "₺" yok (fiyat görünen karede "285 TL" biçimi — vitrin mock'u ortak biçimlendiriciyi kullanır);
cam nesne sözlüğü uygulamadaki gibi (alev = kalori · damla = su · kupa = seri · ayak izi = etkinlik · kase = öğün/sipariş).
Sağlık iddiası yok ("tahmin eder"); eatkcal karesinde yalnız İzmir.

Alternatif başlıklar (karşılama varyantlarıyla aynı dil): 1 → "Takip et. Üret. Paylaş." / "Track. Create. Share." ·
5 → "Tabağından topluluğuna" / "From plate to community" · 4 → "Öğünlerin hikâyene dönüşsün" / "Turn meals into stories".

## Boyutlar
| Hedef | Ölçü (px) | Simülatör / kaynak | Zorunlu mu |
|---|---|---|---|
| App Store 6.9" | 1320 × 2868 | "Store 6.9 iPhone" = iPhone 17 Pro Max (iOS 26.x) | Evet (yoksa 6.5") — küçük boyutlar bundan ölçeklenir |
| App Store 6.5" | 1242 × 2688 | "Store 6.5 iPhone" = iPhone 11 Pro Max (iOS 26.x) | İsteğe bağlı (6.9" verilirse); eski cihaz listelerinde net görünüm için çekilir |
| Google Play telefon (ham) | 1080 × 2160 | 6.9" karesinden: üst 162 px durum çubuğu + alt 66 px ev çizgisi kırpılır → 2:1 → küçültülür | — |
| Google Play telefon (başlıklı) | 1080 × 1920 | `compose-frames.mjs` | 2–8 adet; 9:16; uzun kenar ≤ 2 × kısa kenar |
| Play öne çıkan grafik | 1024 × 500 | elle (öneri: siyah zemin, "Takip et. Üret. Paylaş.", 2 numaralı kare) | Evet |
| iPad | — | `supportsTablet: false` → gerekmez | Hayır |

Not (Android): kareler iOS vitrininden türetilir (durum çubuğu kırpılır, uygulama içeriği iki platformda aynı kabuk).
Gerçek Android cihaz/emülatör görüntüsü istenirse aynı panolar Android dev client'ta `kcal://dev/screen/<Pano>` ile açılır
(bu makinede Android SDK/emülatör yok).

## Çekim betiği
```sh
# Ön koşul: boş disk ≥ 20 GB, dev client derli (CLAUDE.md komut 1), Metro açık:
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
npx expo start --dev-client --port 8081 &
scripts/store/store-shots.sh                       # 2 boyut × 2 dil × 8 kare + Android türetme
STORE_COMPOSE=1 scripts/store/store-shots.sh       # + başlıklı kareler (Chrome başsız)
node scripts/store/compose-frames.mjs .claude/night/out/store   # yalnız başlık katmanı (ham kareler hazırsa)
```
- Çıktı: `.claude/night/out/store/raw/<ios-69|ios-65|android>/<tr|en>/NN-ad.png`, başlıklı: `…/final/…`.
- `scripts/dev/g14-shots.sh` (G14 vitrini) `G14_MODE=storage` ile çağrılır → iOS 26 "… ile Açılsın mı?" onayı yok,
  Erişilebilirlik izni gerekmez (G20-S1 SORULAR 5'teki engel). İlk kurulumda dev client'ta Metro sunucusu bir kez seçilir (betik bekler).
- Durum çubuğu 9:41, pil dolu (g14-shots `status_bar override`). Görünüm açık (uygulama `userInterfaceStyle: light`).
- Betik İlter'in simülatörüne dokunmaz; yalnız "Store …" adlı iki cihaz oluşturur.

**Kuru deneme (bu gece):** `bash -n` ✓; `compose-frames.mjs` sahte görsellerle 3 boyutta koşuldu → 1320×2868, 1242×2688,
1080×1920 ✓ (Bricolage yazı tipi yüklendi). Simülatör çekimi disk kuralı nedeniyle yapılmadı.

## Çekimden sonra kontrol
- [ ] Mock veride gerçek kişi adı/fotoğrafı yok (vitrin mock'ları; Keşfet kareleri özellikle).
- [ ] EN karelerde Türkçe metin kalmadı (FinXxxEN panoları; tarih/sayı biçimi EN).
- [ ] Fiyat görünen karede "TL" biçimi, nokta ayracı yok.
- [ ] Final panosuyla bölge karşılaştırması (G18 `scripts/dev/g18-ssim.ts`, SSIM ≥ 0,80) — mağaza karesi Final'den sapmasın.
- [ ] App Store 2.3.3: kareler uygulamanın gerçek kullanımı; başlık katmanı açıklayıcı, iddia içermez.
