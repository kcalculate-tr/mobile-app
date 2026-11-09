# Tara (AI tarama) — herkese açılış kontrol listesi (G19-S1, 9 Kas)

Bugün: Tara yalnız İlter'e açık (`user_feature_unlocks`). Bu belge `ai_tarama`yı
%10 → %50 → %100 açmanın adımlarını, kapatma anahtarlarını, izlenecek metrikleri ve
Sentry kodlarını listeler. Panolar: FinScanR2, FinMoScan, FinPhotoR1/EN, FinScanError,
FinErrFailed/Offline/Limit, FinScanOffline.

## 0. Ön koşullar (bayrağı açmadan ÖNCE — sırayla)
| # | İş | Kim | Doğrulama |
|---|---|---|---|
| 1 | `supabase/migrations/20261109190100_g19_ai_scan_hardening.sql` uygula (`supabase db push`) | Claude/İlter | `select column_name from information_schema.columns where table_name='ai_scan_reservations'` → `result, attempts, last_attempt_at` var |
| 2 | `analyze-ai-scan` deploy (G19 sürümü) — migration'dan SONRA | Claude/İlter | Aynı anahtarla iki çağrı: ikincisi `cached:true`, `ai_scan_usage.used` artmaz |
| 3 | `AI_SCAN_MODEL` geçerli model + `ANTHROPIC_API_KEY` secret (G17 SORULAR) | İlter | edge yanıtı `config` (500) DEĞİL |
| 4 | İsteğe bağlı `AI_SCAN_TIMEOUT_MS` (vars. 20000, 5000–30000) | — | — |
| 5 | Uygulama: night19/scan birleşmiş sürüm (OTA ya da derleme). expo-camera'sız eski derlemede FinScanViewfinder yedeği çalışır (test: `g19ScanPlatform`) | İlter | Tara açılır, çekim → sonuç |
| 6 | D-S1 (`night19/data`) uygulanmışsa 0. adımdaki migration sözlüğe `scan_open`, `scan_limit` ekler; D-S1 SONRA uygulanırsa G19 migration'ı yeniden çalıştır (idempotent) | Claude | `select name from analytics_event_names where name like 'scan_%'` → 5 satır |
| 7 | `ai_scan_daily_cap` (vars. 1000/gün) ve `ai_scan_user_daily_limit` (3) maliyet bütçesine göre gözden geçir | İlter | `select * from app_settings where key like 'ai_scan_%'` |

## 1. Bayrak planı
`ai_tarama` = giriş kapısı (Tara sekme düğmesi / "…'e logla" Tara ikonu). Arayüz `yeni_kabuk`
ile belirlenir (kapalıysa 1.0.7 Tara ekranı). Kova: `fnv1a(key:uid) % 100 < rollout_percent`
(istemci = sunucu, `src/core/flags/rollout.ts`).

| Dalga | SQL (service role / panel) | Süre | Geçme ölçütü (bir sonrakine geçmek için HEPSİ) |
|---|---|---|---|
| %10 | `update feature_flags set enabled=true, rollout_percent=10 where key='ai_tarama';` | ≥ 48 saat | başarı oranı ≥ %90, `scan_failed` (stage≠local) ≤ %10, `model`/`parse` ≤ %3, p95 analiz ≤ 15 sn, çökme artışı yok, günlük maliyet bütçe içinde |
| %50 | `… rollout_percent=50 …` | ≥ 72 saat | aynı + `ai_scan_daily_cap`'e günün ≥ %80'inde ulaşılmıyor + `rate_limit` ≤ %1 |
| %100 | `… rollout_percent=100 …` | — | aynı |

Notlar
- `min_app_version`: yeni_kabuk akışı G19 düzeltmeleri olmadan açılmamalı → `min_app_version` = G19'u içeren sürüm.
- İlter'in kişi kilidi (`user_feature_unlocks`) dalgalardan bağımsız açık kalır.

## 2. Kapatma anahtarları (hızdan yavaşa)
| Anahtar | Etki | Ne zaman |
|---|---|---|
| `update app_settings set value='0' where key='ai_scan_daily_cap';` | SUNUCU: tüm yeni rezervasyonlar `ok:false` → kullanıcı FinErrLimit görür (hak/maliyet sıfır). Anında, uygulama güncellemesi gerekmez. | Maliyet patlaması, model kötüye kullanımı |
| `update app_settings set value='1' where key='ai_scan_per_minute';` | Dakikada 1 tarama (429 `rate_limit` → FinErrFailed, hak iade) | Bot/döngü şüphesi |
| `update feature_flags set enabled=false where key='ai_tarama';` | Giriş düğmesi kaybolur (bayraklar yeniden çekilince: açılış/ön plana dönüş) | Arayüz/akış hatası |
| `supabase secrets unset ANTHROPIC_API_KEY` (son çare) | edge `config` 500 → FinErrFailed, hak iade | Sağlayıcı sorunu |

Uyarı: `ai_scan_daily_cap=0` kullanıcıya "Bugünkü 3 taramanı kullandın" gösterir (doğru değil ama
güvenli). Ayrı "geçici kapalı" metni Final'de yok → SORULAR.

## 3. İzlenecek metrikler
Kaynak: `analytics_events` (G19-S3 `track` → D-S1 sözlüğü) + `ai_scan_usage` / `ai_scan_reservations`.

| Metrik | Tanım | Alarm |
|---|---|---|
| Açılış → çekim | `scan_start` / `scan_open` | < %40 (kamera/izin sorunu) |
| Başarı oranı | `scan_success` / (`scan_success` + `scan_failed` where stage ≠ 'local') | < %90 (1 saatlik pencere) |
| Logla oranı | `log_meal{source:'scan'}` / `scan_success` | < %50 (sonuç güvenilmez) |
| Düzeltme oranı | `log_meal{edited:true}` / `log_meal{source:'scan'}` | > %60 (model kalitesi) |
| Hata kırılımı | `scan_failed.reason` dağılımı | `model`+`parse` > %3 · `timeout` > %5 · `network` > %15 |
| Limit | `scan_limit` / DAU(Tara) | bilgi (Pro talebi) |
| Kuyruk | `scan_start{offline:true}` ve `scan_failed{reason:'queue_dropped'}` | `queue_dropped` > %2 |
| Maliyet | `select day, sum(used) from ai_scan_usage group by day` × model birim fiyatı | günlük bütçenin %80'i |
| Önbellek | `ai_scan_reservations where status='consumed'` içinde aynı anahtara ikinci çağrı (edge log `cached`) | bilgi (zayıf ağ göstergesi) |
| Sunucu | edge 5xx oranı (Supabase function logs) | > %2 |

SQL örneği (başarı oranı, son 24 saat):
```sql
select
  count(*) filter (where event_name = 'scan_success') as ok,
  count(*) filter (where event_name = 'scan_failed' and props->>'stage' <> 'local') as fail
from analytics_events
where created_at > now() - interval '24 hours';
```

## 4. Sentry kodları (`ai_scan` etiketi: stage · code · http_status — kişisel veri yok)
| stage | code | Anlam | Kullanıcı görür | Hak |
|---|---|---|---|---|
| reserve | unknown / http_* | `reserve_ai_scan` RPC hatası | FinErrFailed | düşmedi |
| upload | no_user | oturum yok | FinErrFailed | iade |
| upload | file_missing | yerel foto silinmiş (önbellek) | FinErrFailed (yeniden çek) / kuyrukta düşer | iade |
| upload | image_too_large | > 5 MB | FinErrFailed "Fotoğraf çok büyük" (rezervasyondan ÖNCE yakalanır) | düşmedi |
| upload | storage / upload_failed | kova yükleme hatası / ağ | FinErrFailed | iade |
| analyze | network / relay | istemci zaman aşımı (45 sn) / ağ | FinErrFailed → Tekrar dene (aynı foto) | iade (sunucuda bittiyse önbellek) |
| analyze | unauthorized · bad_request · forbidden | JWT / gövde / başka kullanıcının yolu | FinErrFailed | iade |
| analyze | config | `ANTHROPIC_API_KEY` yok | FinErrFailed | iade |
| analyze | server | DB okuma hatası | FinErrFailed | iade |
| analyze | reservation / expired | rezervasyon yok/başkasının · dünün (G19: yeniden rezervasyon bugüne taşır) | FinErrFailed | iade |
| analyze | image_not_found · image_type | kovada yok / desteklenmeyen tür / boş | FinErrFailed | iade |
| analyze | rate_limit | dakika sınırı ya da anahtar başına deneme sınırı (429) | FinErrFailed | iade |
| analyze | model | sağlayıcı non-2xx (502) | FinErrFailed | iade |
| analyze | timeout | model > AI_SCAN_TIMEOUT_MS (504) | FinErrFailed | iade |
| analyze | parse | model JSON dışı (502) | FinErrFailed | iade |

## 5. Açılış günü elle kontrol (gerçek cihaz, TR + EN)
1. Tara → izin isteği → reddet → "Kameraya erişim kapalı" → Ayarlar → izin ver → geri dön → canlı görüntü.
2. Detay ekle → not yaz → deklanşör → analiz → sonuçta not satırı görünür.
3. Çok öğeli sonuç: satır kcal'ları dolu; bir öğeyi sil → toplam düşer; gram değiştir → toplam değişir; "Eksik besin ekle" → arama yoksa "… elle ekle" → kcal yaz → eklenir.
4. Logla → Ana sayfa halkası/öğün satırı güncellenir; Geri al → silinir.
5. Uçak modu → çek → FinErrOffline → Tamam → FinScanOffline; bağlantı gelince otomatik loglanır.
6. Analiz sürerken X → Tara'yı yeniden aç → sonuç ekranı gelir (hak boşa gitmez).
7. 3 tarama sonrası → FinErrLimit; İstanbul 00:00 sonrası hak hapı gizlenir, yeni tarama 2/3 gösterir.
8. Cihaz dili EN → yiyecek adları EN.
