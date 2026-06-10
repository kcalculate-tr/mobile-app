# KCAL → Adisyo Toplu Fiyat Güncelleme

23 KCAL ürününün **Tek Fiyat** alanını Adisyo'da tek seferde günceller.
Her ürün için 3 orderType (Masa/Paket/Gel-Al) aynı fiyata set edilir — Adisyo
SaveOrder'ın orderType=1 fiyat validation hatası (`715`) bu sayede kalıcı olarak çözülür.

## Hızlı kurulum

```bash
cd adisyo-price-update
npm install
cp .env.example .env
```

`.env` dosyasını aç ve doldur:

| Değişken | Nereden | Not |
|---|---|---|
| `ADISYO_BEARER_TOKEN` | cURL'deki tam JWT | `eyJ...` ile başlar, çok uzun. **8 Mayıs 2026**'ya kadar geçerli, logout invalidate eder |
| `ADISYO_DEVICE_KEY` | cURL'den | `8a9d8c08217d38013eb14dc06841361d_79664` |
| `ADISYO_RESTAURANT_ID` | cURL'den | `79664` |
| `ADISYO_PUBLIC_API_KEY` | Supabase secret | `ADISYO_API_KEY` ile aynı değer |
| `ADISYO_PUBLIC_API_SECRET` | Supabase secret | `ADISYO_API_SECRET` ile aynı değer |
| `ADISYO_PUBLIC_API_CONSUMER` | Supabase secret | `kcal-mobile` |

## Çalıştırma

### 1) Önce DRY-RUN ile kontrol et
Hiçbir şey kaydetmez, sadece ne olacağını yazdırır:

```bash
node update-prices.mjs --dry-run
```

Beklenen çıktı (örnek):
```
🔸 DRY-RUN modu: hiçbir şey kaydedilmeyecek
🔍 Public API: ürün listesi çekiliyor…
   → 23 KCAL ürünü bulundu
→ KCAL-6     pid=9295921  → 375 TL ... ✅ 6 fiyat güncellendi (DRY-RUN)
→ KCAL-7     pid=9295934  → 375 TL ... ✅ 6 fiyat güncellendi (DRY-RUN)
...
```

`6 fiyat güncellendi` = `defaultProductUnit.prices[3]` + `productUnits[0].prices[3]`.
Bu doğru, Adisyo aynı array'i iki kere referans ediyor.

### 2) Tek bir ürünle gerçek test et
KCAL-7 zaten 375 olmalı, idempotent test için:

```bash
node update-prices.mjs --only KCAL-7
```

Sonra Adisyo panelinden Brokoli (KCAL-7 değil tabii, kontrol için herhangi
bir tek ürün) açıp "Tek Fiyat" alanına bakarak doğrula.

### 3) Hepsini güncelle
```bash
node update-prices.mjs
```

23 ürün × ~250ms = ~6 saniye + public API call'u + her ürünün 2 internal API call'u =
**toplam 1-2 dakika**.

## Sonra ne yapmalı

1. **Test sipariş**: id=14 mantığında bir sipariş daha at, `adisyo_order_id` set
   olduğunu ve OrderTotal hatası alınmadığını doğrula.

2. **DB Webhook'u kur**: Supabase Dashboard → Database → Webhooks → New
   - Table: `orders`
   - Events: `INSERT`, `UPDATE`
   - URL: `adisyo-save-order` Edge Function URL'i
   - Method: POST
   - HTTP Headers: `Authorization: Bearer <SERVICE_ROLE_KEY>`
   
3. **Logout** Adisyo paneli → token invalidate olur → bu .env dosyası
   güvenli şekilde elden çıkar.

## Sorun giderme

**`HTTP 401`**: Token expire (logout sonrası veya 8 Mayıs sonrası). Yeniden
F12'de bir SaveProduct request'i yakala, yeni token'ı .env'ye yapıştır.

**`HTTP 403 / 405`**: Header eksik. cURL'den `devicekey`, `restaurant`, `source: mill`,
`origin` header'larının script'te olduğundan emin ol (zaten var).

**`Public API products array bulunamadı`**: Public API response yapısı
beklenmedik. Script şu yapıları otomatik dener:
`json.data.products` → `json.products` → `json.data` (array) → `json` (array).
Hiçbiri tutmazsa response'un ilk 1000 char'ını yazdırır, oradan görürsün.

**Bir ürün `Adisyo'da bulunamadı`**: O productCode (`KCAL-X`) Adisyo'da yok
veya farklı yazılmış. Adisyo panelinden ürünün "Ürün Kodu" alanını kontrol et.

**`prices[] boş`**: Çok ihtimal yok ama olursa, o ürün için Adisyo'da fiyat
listesi tanımlı değil. Manuel açıp en az bir orderType'a fiyat girmen lazım,
sonra script tekrar çalıştır.
