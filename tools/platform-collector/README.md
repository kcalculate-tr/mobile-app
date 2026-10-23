# KCAL platform veri toplayıcı

Yemeksepeti, Trendyol GO (Uber Eats), Migros Yemek ve (geçmiş için) Getir Yemek restoran panellerinden
**salt-okuma** veri çeker ve tek formatta CSV üretir. Adisyo ve KCAL uygulaması kapsam dışı.

```
extension/            Chrome eklentisi (MV3)
  collectors/         panel başına toplayıcı (sayfanın içinde çalışır)
  runner.js           bir çalıştırmayı yönetir, ham JSON'u indirir
normalize/normalize.py  ham JSON → ~/kcal-reports/platform_data/*.csv
```

## Kurulum (her Chrome profilinde bir kez)
1. `chrome://extensions` → sağ üstte **Geliştirici modu** açık.
2. **Paketlenmemiş öğe yükle** → `tools/platform-collector/extension` klasörünü seçin.
3. Panellere giriş yapın ve sekmeleri açık bırakın.

Profil → panel eşleşmesi:
| Profil | Yemeksepeti | Trendyol GO | Migros | Getir |
|---|---|---|---|---|
| fitzfood.tr | 6 mağaza | Kcalculate ×2 | Basın ×3 | Kcalculate Basın |
| kcalculate.tr | — | Tera Bowl ×2 | Bayraklı ×3 | Tera Bowl Basın |
| ilterozisseven | — | Breaking Fast ×2 | — | Breaking Fast Basın |

## Kullanım
- **İlk kurulum:** eklenti simgesi → *İlk tam çekim*. YS 12 ay, TGO analitik ~120 gün + sipariş geçmişi 12 ay,
  Migros ne kadar varsa (gün 30 / hafta 12 / ay 7, sipariş 30 gün), Getir 23.10.2025–31.08.2026 (bir kez, sonra donar).
- **Her hafta (Cuma 18:00):** eklenti simgesi → *Haftalık çek*. Son 14 gün yeniden çekilir; dönüştürücü eski değerlerin üzerine yazar.
- Açılan "KCAL veri çekimi" sekmesi bitene kadar açık kalmalı. Ham dosyalar `~/Downloads/kcal-platform-raw/<çalıştırma>/` altına iner.
- Üç profilde de çalıştırdıktan sonra:

```bash
python3 tools/platform-collector/normalize/normalize.py
```

Çıktılar `~/kcal-reports/platform_data/`: `platform_metrics.csv`, `reviews.csv`, `cancellations.csv`, `products.csv`,
`campaigns.csv`, `hourly.csv`, `field_map.md` (hangi sütun nereden), `run_log.md` (kontroller).

## Haftalık otomatik rutin (Cuma)
1. **18:00 — çekim (eklenti):** Eklenti her profilde Cuma 18:00'de kendiliğinden çalışır (`chrome.alarms`), kapalı panel sekmelerini açar, son 14 günü çeker, ham dosyaları ve `runner_status.json`'u `~/Downloads/kcal-platform-raw/<çalıştırma>/` altına indirir. Chrome açık ve panellerde oturum açık olmalı. Chrome o saatte kapalıysa, açıldığında çalışır.
2. **19:00 — yayın (launchd):** `publish/weekly_publish.py` sırayla:
   - 18 mağazanın (Yemeksepeti, Trendyol, Migros) ham verisinin geldiğini ve oturum hatası olmadığını kontrol eder,
   - `normalize.py` ile CSV'leri yeniden kurar,
   - 7 gün kontrolünü ve kişisel veri taramasını yapar,
   - sorun yoksa `kcalculate-tr/kcal-platform-data` reposuna `latest/` ve `runs/YYYY-MM-DD/` olarak push eder.

   Sorun varsa push etmez; `~/kcal-reports/platform_data/WEEKLY_FAILED_<tarih>.md` yazar ve macOS bildirimi gösterir. Analiz yapmaz.
3. Kurulum: `bash publish/install_launchd.sh` (bir kez; kod `~/kcal-platform-tools` altına kopyalanır, kod güncellenirse tekrar çalıştırın).
   Elle deneme: `python3 publish/weekly_publish.py --dry-run` (push etmez).

## Kurallar
- Sadece listeleme/rapor uçları çağrılır; siparişe, menüye, mağaza durumuna dokunan hiçbir istek yok.
- Oturum başlıkları sayfanın belleğinde kalır, dosyaya yazılmaz.
- Kişisel veri (ad, telefon, adres, e-posta, konum) toplayıcıda atılır; yorum metinlerinde telefon/e-posta deseni `***` yapılır.
- Ham dosyaları silmeyin: dönüştürücü CSV'leri her seferinde tüm ham dosyalardan yeniden kurar (Getir'in donmuş verisi dahil).

## Bilinen sınırlar
- Trendyol "Pazar Raporu"nun veri ucu yok; panelde **seçili** şube için sayfa metninden okunur (yürütücü her şubeyi sırayla seçer).
- TGO istekleri `x-store-id` başlığı taşır; panelde seçili şube dışındaki şubeler için bazı uçlar reddedebilir.
- Uzun çekimlerde TGO oturum anahtarı süresi dolabilir; hata `run_log.md`'de "Çekilemeyen ekranlar" altında görünür, haftalık çekimi tekrarlayın.
- Yemeksepeti günlük satış raporu sipariş olmayan günleri döndürmez (boş hücre).
