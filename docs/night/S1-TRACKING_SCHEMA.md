# S1 — `tracking` Şeması Tasarım Notu (TASLAK)

**Tarih:** 2026-11-02 · **Dal:** `night/s1-data`
**Migration:** `supabase/migrations/20261102000400_tracking_schema.sql` (+ `_rollback`)
**Durum:** Yalnızca tasarım + şema iskeleti. Uygulama kodu yok, veri taşınmadı, **test edilmedi** (staging yok).

## Neden
Kcalculate tek uygulamadan iki servise ayrılacak:
- **eatkcal** — öğün siparişi (orders, payments, branches, adisyo, marketplace…)
- **Kcalculate AI** — kalori/makro takibi, Keşfet, "ne yemeli", AI önerileri

Takip verisi bugün `public` şemasında sipariş verisiyle iç içe. İki servisin ileride **ayrı şirkete / ayrı DB'ye** taşınabilmesi için takip verisini ayrı bir `tracking` şemasında izole etmek, net bir kesme hattı verir: bir gün `tracking` şeması ayrı bir Supabase projesine `pg_dump --schema=tracking` ile taşınabilir.

## Bugünkü dağınık durum (public şemasında)
| Tablo | İçerik | AI servisine mi? |
|---|---|---|
| `public.meal_logs` | id, user_id, date, meal_type, calories, note | ✅ öğün logu (sade) |
| `public.meal_consumptions` | +protein/carbs/fat, source, source_ref, consumed_at | ✅ öğün logu (zengin) |
| `public.user_nutrition_profiles` | güncel hedefler (target_*), profil (yaş/boy/kilo/aktivite), custom makrolar | ✅ profil + **güncel** hedef |
| `public.body_measurements` | tartım/ölçü geçmişi | ✅ takip |
| `public.analytics_events` | genel olay akışı (props jsonb) | ⚠️ karışık (hem sipariş hem takip) |

Gözlem: **İki ayrı öğün-log tablosu** var (`meal_logs` sade, `meal_consumptions` zengin) — birleştirme adayı. Günlük hedef **geçmişi yok**; yalnızca `user_nutrition_profiles`'taki güncel değer. AI istek/maliyet kaydı **hiç yok** (gözlemlenebilirlik ve birim-maliyet takibi mümkün değil).

## Hedef `tracking` şeması (bu migration ile kurulan iskelet)

### `tracking.meal_entries` — birleşik öğün logu
`meal_logs` + `meal_consumptions` superset'i. `source` (manual/ai/order/barcode) ve `source_ref` ile kaynağı ayırır; sipariş kaynaklı öğünler `source='order'`, `source_ref=order_id` ile bağlanır (çapraz-servis gevşek bağ — FK değil, servis ayrılınca kopmaz).

### `tracking.daily_goals` — tarih bazlı hedef anlık görüntüsü
`user_nutrition_profiles`'taki tek güncel hedefi **tarihe göre** saklar (`unique(user_id, goal_date)`). AI günlük hedef önerirse `source='ai'`. Kullanıcı o gün ne hedefledi/ne tükettiyi karşılaştırma bunu gerektirir.

### `tracking.ai_requests` — AI istek kaydı + maliyet
Her AI çağrısı: `feature` (ne_yemeli/kesfet/analiz), `provider`, `model`, `input_tokens`, `output_tokens`, `total_tokens` (generated), `cost_usd numeric(12,6)`, `latency_ms`, `status`, `request_ref` (idempotency). Kullanıcı başına / özellik başına maliyet raporu ve anomali tespiti sağlar. Yazım **service_role** (edge function); kullanıcı yalnızca kendi kayıtlarını **okur**.

## RLS ve API erişimi
- Tüm tablolarda RLS açık; kullanıcı yalnızca `user_id = auth.uid()` satırları. `auth.uid()` performans için `(select auth.uid())` ile sarmalandı (initplan).
- `tracking` şeması varsayılan olarak PostgREST'e **açık değil**. İki yol:
  1. Kısa vade: edge function'lar `service_role` ile `tracking`'e yazar/okur (ör. `ai_requests`).
  2. Mobil doğrudan erişim gerekiyorsa Dashboard → API → "Exposed schemas"e `tracking` eklenir (**ONAYSIZ — bu gece yapılmadı**).

## Taşıma planı (sonraki iş — bu gecede YOK)
1. `tracking` şeması + tabloları (bu migration) — **yapıldı (taslak)**.
2. Geri-dolum migration'ı: `public.meal_logs` ∪ `meal_consumptions` → `tracking.meal_entries`; `user_nutrition_profiles` güncel hedef → her kullanıcı için `tracking.daily_goals` ilk satır.
3. Çift-yazım dönemi: mobil hem eskiye hem `tracking`'e yazar (veya trigger ile köprü), doğrulama.
4. Okuma yolu `tracking`'e geçer; `public` öğün/hedef tabloları salt-okunur bırakılır.
5. Servis ayrışması: `tracking` ayrı projeye taşınır; `source_ref=order_id` gevşek bağ kopmaz.

## Riskler / açık sorular
- `analytics_events` hem sipariş hem takip olaylarını taşıyor → ayrışmada hangi olay hangi servise? (karar işletmede)
- `meal_logs` mi `meal_consumptions` mı canonical? `meal_entries` ikisini kapsıyor; eski tablolardan hangisinin aktif yazıldığı kod tarafında doğrulanmalı (S1 kapsamı dışı).
- Çapraz-servis FK yok (bilinçli): servis ayrılınca referans bütünlüğü uygulama katmanında korunmalı.
