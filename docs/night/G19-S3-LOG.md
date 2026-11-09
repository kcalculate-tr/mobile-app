# G19-S3 — Ölçüm istemcisi + kaynak takibi · LOG

Dal `night19/metrics` (taban `night18/release` @ 94f3bf8) · worktree `.claude/worktrees/g19-s3` · Ekran tasarımı YOK (yalnız altyapı).
Sözleşme: D-S1 (`night19/data`) `analytics_event_names` + `analytics_events` (RLS insert own, istemciye yalnız INSERT).

## ÖZET (10 satır)
1. Tek giriş `track(name, props)`: 52 olaylık tipli sözlük (`src/lib/metrics/events.ts`, TR/EN açıklama), ad ve prop'lar derleme anında denetlenir.
2. Kişisel veri: prop beyaz listesi + değer süzgeci (e-posta, telefon, TCKN, kart, IBAN, koordinat) — `sanitize.ts`; sunucuda D-S1 tetikleyicisi ikinci kapı.
3. Kuyruk: kalıcı (500), toplu insert (50), çevrimdışı, üstel yeniden deneme, zehirli parti atılır, oturum değişince user_id NULL; 30 dk oturum kimliği.
4. anon_id her satırda; girişte `signup` (yeni hesap) / `login` olayı iki kimliği birlikte taşır.
5. Meta yalnız 5 reklam olayı (görüntüleme, sepete ekleme, ödemeye geçiş, satın alma, kayıt) — parametreler eski `logEvent.*` ile birebir; ATT sırası aynen.
6. Mevcut 46 çağrı (36 track + 10 logEvent) sözlüğe bağlandı; eksik huni olayları eklendi (onb_step, scan_*, log_*, water/activity, share, follow, coupon/saha).
7. Kaynak takibi: ilk açılışta first_touch (UTM, l.eatkcal.com, /k/ kutu kartı QR, /s/ saha kodu, paylaşım bağlantısı, yoksa direct); sipariş olaylarına ilk/son dokunma + channel.
8. Rıza: Meta = iOS'ta ATT granted VE uygulama içi reklam rızası 'denied' değil; birinci taraf ölçüm kapatılabilir; KVKK aydınlatma + rıza metinleri i18n'de (TR+EN).
9. Testler: 51 yeni birim + 11 yeni bileşen + PGlite 8/8; tsc 0; birim 768/768 (1 atlanan, tabandaki); bileşen 199/199.
10. Migration YALNIZ DOSYA (14 yeni olay adını sunucu sözlüğüne yazar); canlıya dokunulmadı, deploy yok.

## Commit tablosu
| Commit | Madde | İçerik |
|---|---|---|
| 8b68a71 | md.1 · md.3 · md.4 | `src/lib/metrics/*` (sözlük, süzgeç, kuyruk, kaynak, rıza, i18n), `src/lib/analytics.ts` yeniden yazıldı, `App.tsx` startMetrics, `AuthContext` identifyUser, `dictionaries.ts` metrics.* |
| 49688b0 | md.2 | 23 çağrı dosyası: logEvent.* → track(); yeni olaylar (scan/log/water/activity/share/follow/onb_step/coupon) |
| 91b0cd1 | md.5 | 5 node:test dosyası + `analyticsAtt.test.tsx`; migration + rollback; `supabase/tests/g19_s3.check.mjs` |
| (bu) | LOG | `docs/night/G19-S3-LOG.md` |
| (son) | DONE | `docs/night/G19-S3-DONE` |

## Kontroller
| Kontrol | Sonuç |
|---|---|
| `tsc --noEmit` | 0 hata |
| `npm run hygiene` | OK |
| `npm run test:unit` | 769 test · 768 geçti · 0 hata · 1 atlandı (tabanda da atlanıyor; taban 717 geçiyordu → +51) |
| `jest` (bileşen) | 36 paket · 199/199 · 2/2 snapshot (bayrak kapalı Tracker parite snapshot'ı dahil) |
| `noLegacyWhenFlagsOn`, `i18nKeys` (TR/EN eksik anahtar 0) | geçti (birim paketinde) |
| PGlite (`supabase/tests/g19_s3.check.mjs`) | 8/8 — tablo yokken no-op; 2 kez → 52 ad; D-S1 açıklamaları korunur; alias hedefleri var; rollback 2 kez → 38 |
| `expo export` iOS + Android | çıkış 0, iki paket (bkz. Export) |
| Eski tasarım | 0 (görsel/düzen değişikliği yok; yalnız olay çağrıları) |

Not (ortam): ilk jest koşusunda `node_modules` kardeş worktree'ye sembolik bağ olduğu için Tracker snapshot'ında logo yolu `../../../../g19-s3/assets/…` çıktı ve FinScanCamera ilk testi soğuk dönüşümde 5 sn'yi aştı. `node_modules` APFS klonuyla (`cp -c`) gerçek dizine çevrildi ve işe özel temiz jest önbelleğiyle (`--cacheDirectory`) koşuldu → 199/199. Kod kaynaklı değildi. Worktree'deki `node_modules` klonu iş bitince silinebilir (.gitignore'da).

## Olay sözlüğü (özet)
- **Yaşam döngüsü:** app_open{cold,first} · first_touch{source,medium,campaign,content,term,code,link} · signup{method}* · login{method} · onb_step{flow,step,index} · welcome_view · welcome_login_click · welcome_skip_click
- **Takip:** scan_open · scan_capture{via,has_hint} · scan_success{n_items,kcal,via} · scan_fail{code,stage,via} · scan_limit · scan_offline{pending} · scan_log{n_items,kcal,edited} · log_add{source,kcal} · log_edit{field} · log_delete{source,count} · water_add{ml} · activity_add{type,minutes} · streak_day · ring_complete (+ D-S1 eski adları scan_start, scan_failed, log_meal, log_water, log_activity)
- **Sosyal:** share{target,surface} · follow{on,state,surface}
- **Ticaret:** home_view · banner_view/click · announcement_strip_click · product_view* · add_to_cart* · remove_from_cart · cart_view · begin_checkout*† · payment_attempt/pending/failed · payment_success*† · reorder_* · order_review_submitted (checkout_start, pay_success = alias)
- **Pazarlama:** coupon_apply{code,ok,reason,discount} · saha_code_apply{…,from_link}
- **Sunucu (istemci yazmaz):** purchase · order_delivered
- `*` = Meta'ya da gider · `†` = kaynak alanları eklenir (channel, ft_*, lt_*, lt_code, lt_age_h)

## KARAR
- **Tek API:** `logEvent.*` dışa aktarımı kaldırıldı; Meta, sözlükteki `meta` uyarlayıcısıyla `track()` içinden gider. Böylece çağrı noktasında çift Meta olayı riski yok; test `logEvent.`/`AppEventsLogger.`/`from('analytics_events')` doğrudan kullanımını yasaklıyor.
- **Meta parametreleri birebir:** content_id, content_name, currency TRY, value, num_items, order_id. Bunun için `product_view` prop'una `product_name` eklendi (katalog adı, kişisel veri değil).
- **Yeni Meta olayı:** `signup` → CompletedRegistration (eski kodda tanımlı ama hiç çağrılmıyordu). Rıza/ATT kapısından geçer.
- **Alias yönü (D-S1 ile aynı):** `checkout_start`/`pay_success` yalnız sözlükte; istemci geçmiş veriyle süreklilik için kanonik `begin_checkout`/`payment_success` yazar. Tara/takip olaylarında G19-S1/S2 görev listelerindeki adlar kanonik yazılır (scan_capture, scan_fail, log_add, water_add, activity_add) ve D-S1'in eski adlarına `alias_of` ile bağlanır.
- **order_delivered** zaten sunucu tetikleyicisinde (`record_order_delivered_event`) → istemci yazmaz (tip izin vermez).
- **Saha kodu tanımı:** D-S1 `admin_kpi` kuralıyla aynı — kod `SAHA` ile başlar (ya da son 7 gün içinde `/s/<kod>` saha bağlantısından gelen kodla aynı). Tek ölçüm noktası `validateCoupon` (bütün kupon ekranları bunu kullanıyor). Ağ/RPC hatası kupon sonucu sayılmaz.
- **Kişiye bağlanan yol parçası saklanmaz:** `/p/<id>`, `/u/<handle>` için yalnız `link=post|profile`.
- **Rıza varsayılanı ('unset'):** bugünkü davranış korunur (iOS: ATT'ye bağlı; Android: açık). 'denied' her platformda Meta'yı kapatır (Android'de IDFA toplama + otomatik olay da kapatılır). Görev "mevcut davranış korunur" dediği için varsayılan değiştirilmedi → SORULAR 1.
- **Kuyruk zehirli parti:** kalıcı ret (RLS/şema, 4xx) 5 denemede atılır; D-S1 A1 düzeltmesi canlıya gelmeden de istemci uyuşmayan user_id'yi NULL'a çeker → eski "kuyruk sonsuza dek takılı" açığı istemcide de kapandı.
- **Oturum:** soğuk başlangıç yerine 30 dk sessizlik kuralı; sıcak dönüşte `app_open{cold:false}`.
- **identifyUser:** aynı cihaz-kullanıcı çifti bir kez `login` (SIGNED_IN oturum geri yüklemede tekrar gelebilir); yeni hesap = `created_at` ≤ 10 dk.
- **Canlı DB okuma (MCP) reddedildi** → `CANLI_SEMA_2026-11-09.md` + D-S1 migration'ı kullanıldı (kural gereği).
- **PGlite** pakete eklenmedi; başka bir işin geçici dizinindeki kurulum yalnız okunarak kullanıldı (`PGLITE_DIR`).

## Temas (birleştirmede dikkat — S5/birleştiren için)
G19-S1 (Tara) ve G19-S2 (takip) aynı dosyalarda çalışıyor; bu dal yalnız tek satırlık `track(...)` çağrıları ekledi:
- `src/modules/ai/scan/screens/ScanScreen.tsx` (scan_open, scan_capture, sonuç, scan_offline, scan_log; `runFinCapture(uri, via)` parametresi), `src/modules/ai/scan/drainPending.ts`
- `src/screens/TrackerScreen.tsx` (log_add ×3, log_delete ×2, log_edit), `src/modules/gun/water.ts` (water_add), `src/modules/kesfet/ui/TrackerActivityEntry.tsx` (activity_add), `src/screens/tracker/HomeCelebrations.tsx` (share)
- S1/S2 aynı olayları kendi dallarında da eklerse **çift sayım** olur → birleştirmede tek kopya kalmalı. Adlar S1 md.6 / S2 md.7 listeleriyle birebir; sözlükte hepsi var, tipli `track()` ile derlenir. `streak_day`, `ring_complete` sözlükte var ama bu dalda çağrılmadı (S2'nin seri/halka kodu).
- `src/lib/analytics.ts` API değişti: `logEvent` artık yok; S1/S2 yeni kodda `logEvent` kullandıysa `track()`'e çevrilmeli (tsc yakalar).

## CANLIYA UYGULANACAK
1. Önce D-S1: `20261109100300_d_s1_kpi.sql` (sözlük tablosu + yazım düzeltmeleri).
2. Sonra `supabase/migrations/20261109110000_g19_s3_event_names.sql` (14 yeni ad; D-S1 adlarına dokunmaz). Geri alma: `supabase/rollbacks/20261109110000_g19_s3_event_names_rollback.sql`.
   Doğrulama: `select count(*) from analytics_event_names;` → 52 · `select * from kpi_unknown_event_names;` → yeni sürüm yayıldıktan sonra boş kalmalı.
- Sıra ters uygulanırsa migration NOTICE ile atlar (hata vermez) — D-S1'den sonra yeniden çalıştırılmalı.

## DEPLOY GEREKİR
- Sunucu fonksiyonu deploy'u YOK.
- Uygulama: JS değişikliği (OTA ile gidebilir) — yeni native modül yok (netinfo, expo-linking, tracking-transparency, fbsdk zaten kurulu). Production OTA/build onaysız yapılmadı.
- `/k/<kod>` ve `/s/<kod>` bağlantılarının uygulamayı açması için l.eatkcal.com associatedDomains / intentFilters gerekir (linking.ts notu: 1.0.7'de yok, yeni build ile gelir). Bağlantılar uygulama yokken web'e düşer; web tarafında aynı UTM/kod parametrelerinin mağaza bağlantısına taşınması ayrı iş (ertelenmiş derin bağlantı yok).

## SORULAR
1. **KVKK / Meta varsayılanı:** Android'de (ve iOS'ta ATT granted iken) uygulama içi reklam rızası verilmemiş kullanıcıda Meta bugün açık. KVKK açık rıza gereği varsayılanın "kapalı" olması istenir mi? Tek satır: `consent.ts` → `metaAllowed` içinde `adConsent === 'unset'` için `false`. (Etkisi: Android reklam ölçümü rıza ekranı gelene kadar durur.)
2. **Rıza ekranı:** `setAdConsent` / `setFirstPartyConsent` API'leri ve metinler (`metrics.consent.*`, `metrics.kvkk.*`) hazır; Final'de pano olmadığı için ekran/ayar satırı eklenmedi. Hangi pano (Ayarlar › Gizlilik?) kullanılacak?
3. **KVKK metni hukuki okuma:** `metrics.kvkk.body` mevcut aydınlatma metniyle uyumlu yazıldı (meşru menfaat md. 5/2-f, iletişim info@eatkcal.com, saklama "amacın gerektirdiği süre"). Kesin saklama süresi ve hukuki dayanak onayı gerekir.
4. **Saha kodu kaynağı:** canlıda saha kodları `campaigns.source='saha…'` mı yoksa `SAHA…` kod öneki mi? (Canlı okuma reddedildi.) İstemci D-S1 kuralının ikisini de destekliyor ama yalnız `SAHA` önekini ve saha bağlantısını görebilir; `source` alanı istemciye dönmüyor. Gerekirse `validate_coupon_v2` yanıtına `source` eklenebilir (sunucu değişikliği).
5. **Kutu kartı QR / saha bağlantı biçimi:** `l.eatkcal.com/k/<kod>` ve `l.eatkcal.com/s/<kod>` (alternatif `?kutu=` / `?saha=`) varsayıldı. Basılı kartlarda başka bir biçim kullanılıyorsa `attribution.ts` → `parseAttribution` güncellenmeli.
6. **G19-S1/S2 ile çift olay:** birleştirmede aynı olayın iki çağrısı kalırsa çift sayım — yukarıdaki "Temas" listesine göre tek kopya bırakılmalı.

## Export
- `CI=1 npx expo export --platform ios --platform android` (çıktı iş geçici dizinine, repoya değil) → çıkış 0 · iOS `index-615468ab….hbc` 10,2 MB · Android `index-c69845af….hbc` 10,2 MB. `ios/`, `android/` klasörü üretilmedi.
