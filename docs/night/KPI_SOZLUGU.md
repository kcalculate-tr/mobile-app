# KPI Sözlüğü — D-S1 (9 Kas 2026)

Tek kaynak: `public.admin_kpi(p_from date, p_to date, p_branch uuid default null) → jsonb`
(migration `20261109100300_d_s1_kpi.sql`). Yetki: `is_admin()` (admin_allowlist) ya da service_role.
Tarihler **İstanbul takvim günü**, `from` ve `to` ikisi de dahil, en çok 400 gün.
**Şube süzgeci** yalnız sipariş temelli metriklere uygulanır (⛁ işaretli); kullanıcı/etkinlik
metrikleri şubeden bağımsızdır.

Sipariş evreni = **`kpi_orders_unified`** görünümü:
- `orders` (uygulama + `trendyolgo` gibi doğrudan entegrasyonlar): `payment_status = 'paid'` **ve**
  `status ∈ (confirmed, preparing, on_way, delivered)`. İptal / ödenmemiş sayılmaz.
- ∪ `adisyo_orders` (Adisyo'daki uygulama DIŞI siparişler): `is_cancelled = false`, `app_order_id is null`,
  `channel <> 'app'`, `orders.adisyo_order_id` ile eşleşmiyor.
- Çift sayım: uygulama siparişi Adisyo'da da var → `orders`'tan sayılır. `orders.source <> 'app'` ve
  aynı pazar yeri kodu `adisyo_orders.external_ref`'te varsa → `adisyo_orders`'tan sayılır.
- Tutar: `orders.total_amount` (yoksa `total_price`), `adisyo_orders.total` (Adisyo `orderTotal`).
  Teslimat ücreti dahil, KDV dahil (brüt tahsilat).

| # | Metrik | Tanım | SQL kaynağı (`admin_kpi` anahtarı ← tablo) | Panelde nerede |
|---|---|---|---|---|
| 1 | Günlük sipariş ⛁ | Gün başına sipariş sayısı, tüm kanallar | `orders_daily[].orders` ← `kpi_orders_unified` | Merkez › Genel bakış › "Sipariş" kartı; Şube karşılaştırması › Sipariş |
| 2 | Günlük uygulama siparişi ⛁ | Aynı, yalnız `channel = 'app'` | `orders_daily[].app_orders` | Merkez › Kanal dağılımı › Uygulama |
| 3 | Ciro ⛁ | Sayılan siparişlerin tutar toplamı (brüt) | `orders_daily[].revenue`, `totals.revenue` | Merkez › "Bugün ciro"; Şube karşılaştırması › Ciro |
| 4 | Ortalama sepet ⛁ | Ciro ÷ sipariş sayısı | `orders_daily[].avg_basket`, `totals.avg_basket` | Merkez › "Ortalama sepet"; Şube karşılaştırması |
| 5 | İndirim toplamı ⛁ | `orders.discount_amount` + `adisyo_orders.discount` | `totals.discount` | Pazarlama › Kampanya ve kupon (maliyet) |
| 6 | Ortalama günlük sipariş ⛁ | Toplam sipariş ÷ gün sayısı | `totals.avg_daily_orders` | Merkez › Genel bakış (aralık seçiliyken) |
| 7 | Kanal payı ⛁ | Kanal sipariş sayısı ÷ toplam (ve ciro payı). Kanallar: app · yemeksepeti · trendyol_go · getir · migros · salon · telefon · diger | `channels[].order_share`, `.revenue_share` ← `kpi_orders_unified.channel` (Adisyo `externalAppName`/`salesChannelName` normalize: `_shared/adisyo-orders.ts`) | Merkez › "Uygulama payı" kartı + Kanal dağılımı tablosu |
| 8 | Yeni müşteri (uygulama) ⛁ | Aralıkta sipariş veren ve **ilk ödenmiş uygulama siparişi** aralıkta olan kullanıcı | `customers.new` ← `kpi_orders_unified` (src=orders, channel=app) | Merkez › Uygulama hunisi › "İlk sipariş" |
| 9 | Tekrar müşteri (uygulama) ⛁ | Aralıkta sipariş veren, ilk siparişi aralıktan önce olan kullanıcı; pay = tekrar ÷ (yeni+tekrar) | `customers.returning`, `.returning_share` | Merkez › Uygulama hunisi › "Tekrar sipariş"; Müşteriler |
| 10 | D1 / D7 / D30 tutma | Kohort = aralıkta kayıt olan (`profiles.created_at`, İst. günü); tutuldu = kayıt gününden **tam N gün sonra** herhangi bir `analytics_events` olayı. Yalnız `kayıt günü + N < bugün` olan kohortlar sayılır | `retention.d1/d7/d30.{cohort, retained, rate}` ← `profiles`, `analytics_events` | Kcalculate AI › Genel bakış › "Tutunma D1/D7/D30" + Tutunma eğrisi |
| 11 | DAU | Gün başına tekil aktör: `coalesce(user_id, 'a:'+anon_id)` | `active.dau_daily[]`, `active.dau_avg` ← `analytics_events` | Kcalculate AI › "Aktif kullanıcı" alt satırı (günlük) |
| 12 | WAU | `to` dahil son 7 gün tekil aktör | `active.wau` | Kcalculate AI › Kullanıcılar |
| 13 | MAU | `to` dahil son 30 gün tekil aktör | `active.mau` | Kcalculate AI › "Aktif kullanıcı · aylık" |
| 14 | Tarama / gün | `ai_scan_usage.used` gün toplamı; `users` = o gün ≥1 tarama yapan | `scans.daily[]`, `scans.total`, `scans.per_day_avg` ← `ai_scan_usage` | Kcalculate AI › Genel bakış ("AI maliyeti / kullanıcı" paydası) |
| 15 | Keşfet paylaşımı | Yayımlanan gönderi (`posts.status='published'`, `published_at`), gönderi yapan kişi, gün kartı paylaşımı (`day_shares`), `share` olayı | `explore.{posts, posting_users, day_shares, share_events}` | Kcalculate AI › Topluluk |
| 16 | Kupon sonucu ⛁ | Kod başına (büyük harf) ödenmiş sipariş, ciro, indirim, **ilk sipariş** sayısı (kodla gelen yeni müşteri); kaynak `campaigns.source` | `coupons[]` ← `kpi_orders_unified.coupon_code` + `campaigns` | Pazarlama › Kampanya ve kupon › "Kullanım" sütunu |
| 17 | Kupon uygulama olayı | `coupon_apply` olay sayısı ve `props.ok = true` olanlar (deneme → başarı) | `coupon_events.{apply_events, apply_ok}` ← `analytics_events` | Pazarlama › Kupon detayı |
| 18 | Saha kodu sonucu ⛁ | Kupon gibi; kod `campaigns.source ILIKE 'saha%'` ya da `SAHA` önekli. Ayrıca `saha_code_apply` olayı / başarılı | `saha.{codes[], apply_events, apply_ok}` | Saha › Performans / Saha kampanyaları; Merkez › Saha onayları |
| 19 | 150/gün hedef ilerlemesi ⛁ | Hedef `app_settings.kpi_targets.daily_orders` (varsayılan 150). Hedefi tutan gün sayısı, ortalama ilerleme (ort. günlük ÷ hedef), bugün aralıktaysa bugünkü sipariş / ilerleme / kalan | `target.{daily_orders, days_hit, avg_progress, today}` | Merkez › Genel bakış › "Sipariş" kartı (gün sonu tahmini yanında hedef çubuğu) |
| 20 | Bilinmeyen olay adları | Aralıkta sözlükte (`analytics_event_names`) olmayan olay adları, ilk 20 | `tracking.unknown[]`; görünüm `kpi_unknown_event_names` (30 gün) | Merkez › Ekip ve yetkiler › (teknik sağlık) — panel yeri SORU |

## Olay sözlüğü
Tablo `public.analytics_event_names` (38 olay; TR/EN açıklama, kategori, kaynak, `props_hint`,
`alias_of`, `is_kpi`). Yumuşak: bilinmeyen ad **reddedilmez** (eski sürümlerin toplu kuyruğu
kilitlenmesin), metrik 20'de görünür. Eş adlar: `checkout_start → begin_checkout`,
`pay_success → payment_success` (G19-S3 yeni adları; KPI hesaplarında ikisi de sayılmalı).

KPI'ya giren olaylar: `app_open`, `first_touch`, `signup`, `scan_success`, `log_meal`, `share`,
`product_view`, `add_to_cart`, `begin_checkout`/`checkout_start`, `coupon_apply`,
`saha_code_apply`, `purchase` (sunucu), `order_delivered` (sunucu).

## Yazım kuralları (sunucuda zorunlu — `analytics_events_sanitize` tetikleyicisi)
- Ad: trim + küçük harf + en çok 64 karakter.
- props: nesne değilse `{"_value": …}`; üst düzey kişisel anahtarlar silinir (email, phone, telefon,
  address, adres, first/last/full_name, customer_name, lat/lng/latitude/longitude, card_number, iban,
  tckn, password, token…); 8 KB üstü `{"_truncated": true}`.
- İstemci saati: `created_at > now()+5 dk` ya da `< now()-30 gün` ise `now()` + `_ts_clamped`.
- İstemcide `user_id ≠ auth.uid()` (oturum kapandıktan sonra boşalan kuyruk) → `user_id = NULL`,
  `_user_mismatch = true`; satır reddedilmez, başkası adına yazılamaz.

## Bilinen sınırlar
- Merkez tasarımındaki **Puan**, **Ort. teslimat süresi**, **gün sonu tahmini**, **indirme**
  `admin_kpi`'de YOK (kaynak: `reviews.rating`, `orders.delivered_at - created_at`, saat bazlı
  geçmiş eğri, mağaza konsolu) — sonraki iş.
- Adisyo'daki uygulama dışı siparişlerde müşteri kimliği saklanmadığı için yeni/tekrar müşteri
  yalnız uygulama içindir.
- Adisyo webhook'u 13 Eki 10:41'den beri sessiz: o tarihten sonraki uygulama dışı siparişler,
  webhook düzelene ya da liste uç noktası doğrulanana kadar `adisyo_orders`'ta görünmez.
