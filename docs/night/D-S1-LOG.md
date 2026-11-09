# D-S1 — Veri: Adisyo tüm siparişler + KPI altyapısı · LOG (9 Kas 2026)
Dal `night19/data` (taban `night17/camera`) · worktree `.claude/worktrees/d-s1` · yalnız `supabase/`, `docs/`, `scripts/sql/`. `src/`'e dokunulmadı. Canlıya hiçbir şey uygulanmadı/deploy edilmedi.

## ÖZET
1. `adisyo_orders` (+rollback): kişisel veri içermeyen sipariş özeti, kanal normalize, restaurantKey→şube, app_order_id, raw_hash ile idempotent upsert RPC, RLS (okuma admin, yazma service_role).
2. `adisyo-webhook-receiver`: uygulama dışı order.created/updated → GET /Order → `adisyo_orders`. Uygulama siparişi yolu eski sürümle **bayt bayt aynı** (eski/yeni karşılaştırma testi, 9 senaryo). Hata → `process_error` + `ao_*` yeniden deneme kuyruğu.
3. `adisyo-reconcile` + pg_cron 04:00 İst: kuyruk (eski 2.576 olay dahil → geriye dönük dolum), 48 saat açık siparişler, liste uç noktası `app_settings` ile (varsayılan KAPALI), relink.
4. Webhook sağlık alarmı: 15 dk'da bir, 09:00–21:30'da > 90 dk sessizlikte order-alert `webhook_health` ile kesinti başına TEK e-posta.
5. KPI: 38 olaylık TR/EN sözlük, `analytics_events` yazım açıkları (5 adet) sunucuda düzeltildi, 3 görünüm, `admin_kpi(from,to,branch?)` (20 metrik).
6. Test: PGlite 109/109 (3 migration × 2 koşu + rollback + yeniden uygulama + davranış), Deno 16 birim + 7 alıcı karşılaştırma testi, tip kontrolü temiz.
7. `docs/night/KPI_SOZLUGU.md`: metrik · tanım · SQL kaynağı · panel yeri. Canlı doğrulama: `scripts/sql/d_s1_dogrulama.sql`.
8. Engeller: Supabase MCP okuma reddedildi (CANLI_SEMA kullanıldı); kcal-web'de PGlite kurulu değil (geçici dizine kuruldu, repoya eklenmedi).
9. Canlı veriyle doğrulanamayanlar: gerçek kanal adları, restaurantKey değerleri, liste uç noktası → SORULAR.
10. Sıradaki adım (İlter): migration'lar + 3 fonksiyon deploy, sonra `adisyo-debug` ile liste uç noktası denemesi ve Adisyo panel webhook kontrolü.

## Commit tablosu
| Commit | Madde | İçerik |
|---|---|---|
| `de091a7` | 1, 2, 6 | adisyo_orders migration + rollback, `_shared/adisyo-orders.ts`, webhook alıcısı, Deno birim testi, PGlite iskeleti |
| `de7b874` | 2, 6 | alıcı eski/yeni karşılaştırma testi (fixture = night17/camera sürümü, sahte Supabase/serve) |
| `6948c17` | 3, 4, 6 | adisyo-reconcile (çekirdek + index), cron + sağlık migration'ı + rollback, order-alert `webhook_health`, config.toml |
| `78afc32` | 5, 6 | KPI migration + rollback, PGlite KPI bölümü (elle hesaplanmış tohum verisi) |
| `0046931` | 7 | KPI_SOZLUGU.md, `scripts/sql/d_s1_dogrulama.sql` |
| (bu) | — | D-S1-LOG.md, ardından D-S1-DONE |

Testleri çalıştırma:
```
deno test --no-config supabase/tests/adisyo_orders.test.ts supabase/tests/adisyo_reconcile.test.ts
deno test --no-check --no-config --import-map=supabase/tests/stubs/import_map.json --allow-env --allow-read supabase/tests/adisyo_webhook_receiver.test.ts
PGLITE_DIR=<@electric-sql/pglite içeren node_modules'un üst dizini> node supabase/tests/d_s1.check.mjs
```
(PGLITE_DIR verilmezse `~/dev/kcal-web` ve `~/dev/kcal-web-*` denenir; bu gece hiçbirinde yoktu → `npm i @electric-sql/pglite@0.2.17` geçici dizine.)

## KARAR
- **Migration numaraları** `20261109100100/200/300`: diğer oturumların `20261108…`/`20261109000…` numaralarıyla çakışmasın diye.
- **Kişisel veri iki katmanda süzülür**: TS beyaz listesi (`toAdisyoOrderRow`) + SQL `adisyo_order_upsert` yalnız bilinen anahtarları okur, items'ı yeniden kurar. Ürün notu, sipariş notu, müşteri, konum, kurye/garson adı SAKLANMAZ; telefon/e-posta desenli iptal nedeni `[gizlendi]`. Uygulama dışı siparişlerin GET yanıtı `adisyo_api_log`'a **gövdesiz** yazılır (`GetOrder.external`). Uygulama siparişinin mevcut `GetOrder.response` loglaması (PII içerir) bayt bayt aynılık gereği DEĞİŞTİRİLMEDİ → SORULAR.
- **Kuyruk = `adisyo_webhook_events` üzerinde `ao_*` kolonları** (ayrı tablo değil): `ao_synced_at` boş + imza geçerli + sipariş id dolu. Böylece 13 Eki öncesi 2.576 uygulama dışı olay da otomatik kuyruğa girer; reconcile her gece 150 sipariş (yeni→eski) doldurur (ayar `batch`).
- **Uygulama siparişinde yan yazım**: order.updated'da zaten alınan GET yanıtıyla `adisyo_orders` upsert (ek Adisyo çağrısı yok), yalnız `ao_*` yazar; `processed/process_error`, `orders`, yanıt gövdesi, api_log aynen. order.created'da uygulama siparişi için hiçbir şey eklenmedi.
- **Reconcile uygulama siparişlerinin `orders.status`'una dokunmaz**; yalnız `adisyo_orders` + `ao_*`. Uygulama dışı olaylarda başarıda `processed=true, process_error=null` yapılır (eski `unknown_adisyo_order_id` hataları temizlenir).
- **Şube eşlemesi**: `branches.adisyo_config.restaurantKey` (ya da `restaurantKeys[]`). Eşleşmezse uygulama siparişinin şubesi; o da yoksa NULL (varsayılan şubeye düşme `app_settings.adisyo_orders.default_branch_fallback`, varsayılan **false**). `adisyo_orders_relink()` her gece sonradan düzeltir.
- **Kanal**: önce `externalAppName`, sonra `salesChannelName`; ad yoksa sipariş tipi (1 masa → salon, 2 paket → telefon, 3 gel-al → salon). Gel-al "salon" sayıldı (listede ayrı kanal yok). `orders.adisyo_order_id` eşleşmesi her zaman `app`.
- **Çift sayım** (KPI): uygulama siparişi `orders`'tan; `trendyolgo` gibi `orders.source<>'app'` siparişler, aynı kod `adisyo_orders.external_ref`'te varsa Adisyo tarafından sayılır.
- **Sağlık alarmı**: "son olay" imzası geçersiz olayları da sayar (webhook ulaşıyor demektir; imza sorunu e-postada ayrıca "son geçerli imzalı olay" olarak görünür). Ölçüm açılıştan başlar (gece sessizliği sabah alarm üretmez). Kesinti anahtarı = son olay zamanı → aynı kesintiye ikinci e-posta yok; Vault anahtarı yoksa gönderilmez ve işaretlenmez.
- **Olay sözlüğü YUMUŞAK** (CHECK/FK yok): istemci kuyruğu toplu insert yapıyor; tek bilinmeyen ad bütün kuyruğu kalıcı kilitlerdi. Bilinmeyenler `admin_kpi.tracking.unknown` ve `kpi_unknown_event_names`'te.
- **analytics_events açıkları** (src okunarak bulundu, sunucuda düzeltildi; `src/` değişmedi): A1 oturum değişince kuyruk RLS'te sonsuza dek takılıyordu → uyuşmayan `user_id` NULL + işaret; A2 cihaz saati → ±kırpma (yalnız istemci rolleri); A3 props'ta kişisel anahtar silme + 8 KB sınırı; A4 ad normalize; A5 politika public→anon+authenticated, istemciye yalnız INSERT.
- **admin_kpi yetkisi**: canlıdaki `public.is_admin()` (admin_allowlist, security definer) ya da JWT rolü service_role. Görünümler yalnız service_role.
- **"Bütün migration'lar PGlite'ta 2 kez"** = D-S1'in 3 migration'ı (repo genelindeki ~200 migration storage/extension bağımlılığı yüzünden PGlite'ta koşmaz); canlı şema `supabase/tests/d_s1_base_stub.sql` ile CANLI_SEMA kolon adlarıyla taklit edildi.

## CANLIYA UYGULANACAK (sırayla, onayla)
1. `supabase db push` ile: `20261109100100_d_s1_adisyo_orders.sql` → `20261109100200_d_s1_adisyo_reconcile_health.sql` → `20261109100300_d_s1_kpi.sql`.
   - 100300, büyük `analytics_events` tablosunda 3 indeksi `CONCURRENTLY` olmadan kurar (kısa yazma kilidi) → trafiğin düşük olduğu saatte.
   - 100200 cron'ları kurar; adisyo-reconcile deploy edilmeden ilk gece 04:00'te 404 alır (zararsız).
2. `scripts/sql/d_s1_dogrulama.sql` 1–5. sorgular.
3. Şube anahtarları: doğrulama 4. sorgudaki eşlenmemiş `restaurant_key`'ler için dosyadaki şablonla `branches.adisyo_config.restaurantKey` yaz → `select public.adisyo_orders_relink();`.
4. Backend commit'leri proje kuralı gereği main'e de cherry-pick edilecek (bu gece yasak; yapılmadı).

## DEPLOY GEREKİR
- `supabase functions deploy adisyo-webhook-receiver` (verify_jwt **false** kalmalı — `--no-verify-jwt`)
- `supabase functions deploy adisyo-reconcile` (YENİ, verify_jwt true; secret yeni değil: ADISYO_API_KEY/SECRET/CONSUMER mevcut)
- `supabase functions deploy order-alert` (`webhook_health` türü)
- Panel (kcal-web, P-oturumları): `admin_kpi` RPC'sini Merkez › Genel bakış, Kcalculate AI › Genel bakış, Pazarlama'ya bağlamak — KPI_SOZLUGU.md "Panelde nerede" sütunu.

### İlter için: liste uç noktası denemesi (adisyo-debug, yalnız GET)
`adisyo-debug`'ın ALLOWED_GET listesinde `Orders` zaten var. Yanıt KİŞİSEL VERİ içerir → yalnız şekline bak, bir yere yapıştırma:
```
curl -s -X POST "https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/adisyo-debug" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
  -d '{"endpoint":"Orders","urlSuffix":"?startDate=2026-11-08&endDate=2026-11-08"}' \
  | jq '{http: .status, adisyo: .body.status, msg: .body.message, tur: (.body.data|type), adet: (.body.data|length?), alanlar: ((.body.data[0]? // .body.data.orders[0]? // {})|keys)}'
```
Boş/404 dönerse sırayla dene: `"?beginDate=2026-11-08&endDate=2026-11-08"`, `"?StartDate=2026-11-08T00:00:00&EndDate=2026-11-08T23:59:59"`, `"rawUrl":"https://ext.adisyo.com/api/External/v2/Orders/List?startDate=2026-11-08&endDate=2026-11-08"`.
Çalışan biçim bulunursa:
```
update public.app_settings set value = value || '{"list_endpoint_enabled": true, "list_endpoint_path": "Orders", "list_query": "?startDate={from}&endDate={to}"}'::jsonb where key = 'adisyo_reconcile';
```
(`list_query`'yi çalışan biçime göre değiştir; `{from}`/`{to}` = İstanbul'a göre dün.)

### Webhook kesintisi teşhis listesi (13 Eki 10:41'den beri olay yok)
1. **Adisyo paneli** → Entegrasyonlar/Webhook: kayıt duruyor mu, URL `https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/adisyo-webhook-receiver` mi, `order.created`/`order.updated` işaretli mi, "test" gönderimi 200 dönüyor mu (gövde `adisyo` → yanıt `adisyo`).
2. **verify_jwt**: config.toml'da `false`; son deploy `--no-verify-jwt`'siz yapıldıysa Adisyo 401 alır ve olay tabloya hiç düşmez → Edge Function loglarında 401 ara.
3. **URL / proje**: fonksiyon adı/proje ref değişti mi; Edge Function son çağrı zamanı 13 Eki civarı mı.
4. **İmza**: olay geliyor ama `signature_valid=false` ise webhook panelde yeniden oluşturulmuş → yeni anahtar `ADISYO_WEBHOOK_API_KEY` secret'ına. (Bu durumda olaylar tabloya YAZILIR; tabloda hiç olay yoksa sorun 1–3.)
5. **Adisyo tarafı**: lisans/hesap/restoran anahtarı değişikliği, Adisyo'nun webhook'u ardışık hatalardan sonra otomatik kapatması → Adisyo destek.
Alarm devreye girince bu liste e-postada da gelir.

## SORULAR
1. **Supabase MCP okuma reddedildi** (otomatik mod sınıflandırıcısı). Bu yüzden gerçek `salesChannelName`/`externalAppName` değerleri, `restaurantKey`'ler ve `adisyo_config` anahtarları görülmedi; kanal kuralları yaygın adlarla yazıldı. Deploy sonrası doğrulama 4. sorgusundaki `diger` kanal adları normalize kuralına eklenmeli.
2. **PGlite kcal-web'de kurulu değil** (`~/dev/kcal-web*` hiçbirinde `@electric-sql/pglite` yok). Geçici dizine kuruldu, repoya eklenmedi. kcal-web'e dev bağımlılığı olarak eklenecek mi?
3. **Saha kodu tablosu**: P-S4'ün `saha_kodlari` tablosu kcal-web'de/canlıda değil; şimdilik saha kodu = `campaigns.source ILIKE 'saha%'` ya da `SAHA` öneki + `saha_code_apply` olayı. P-S4 tablosu canlıya çıkınca `admin_kpi.saha` ona bağlansın mı?
4. **Şube Adisyo hesapları**: alıcı ve reconcile GET'i merkez (env) kimliğiyle yapıyor. Şubeler kendi Adisyo hesaplarından webhook gönderirse GET başarısız olur (kuyrukta `ao_error`). Webhook hangi hesap(lar)a kayıtlı?
5. **Trendyol Go çift kanal**: `trendyolgo-poll` açıksa aynı sipariş hem `orders`'ta hem (Adisyo'nun kendi Trendyol entegrasyonuyla) `adisyo_orders`'ta olabilir; `external_ref` (Adisyo `confirmationCode`) ile `orders.external_code` aynı kod mu? Değilse KPI'da Trendyol iki kez sayılır.
6. **Mevcut PII**: uygulama siparişlerinin `GetOrder.response` gövdeleri (müşteri adı/telefon/adres) `adisyo_api_log`'da duruyor (eski davranış, bayt bayt aynılık için dokunulmadı). Saklama süresi/temizleme kararı?
7. **Panelde eksik metrikler**: Merkez tasarımındaki Puan, Ort. teslimat süresi, gün sonu tahmini, indirme sayısı `admin_kpi`'de yok — sonraki oturumda eklensin mi?
8. Bilinmeyen olay adları (metrik 20) panelde nerede gösterilsin?
