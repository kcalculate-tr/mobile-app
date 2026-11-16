# G55-S1 — İngilizce bildirimler (dile göre gönderim) + 1.1.1 build hazırlığı (16 Kas)

Dal `release/1.1.0` · worktree `.claude/worktrees/g23-s1` · başlangıç `04eaa9a`. Uygulama tarafı yalnız JS/TS (OTA uyumlu), yeni paket yok. Deploy / OTA / canlı DB yazma / migration uygulama YOK (Supabase MCP yalnız okuma).

## ÖZET
1. **md.0 kök neden doğrulandı:** 14 Kas 20:26:01 UTC edge logu `GET | 400 | /rest/v1/notification_preferences?select=*&user_id=in.(…829 UUID…)`. Kod `error`'a bakmadığı için tercih haritası boş kaldı → 829 kişinin tamamı `marketing disabled by user` diye atlandı (829 `skipped` satırı yazıldı; o an 830 tercih satırının 817'sinde pazarlama AÇIKTI). Kampanya `sent` oldu; 20:31'de 80'lik `by_content` partileriyle 363 kişiye gitti.
2. **md.0 düzeltme:** `send-notification` çekirdeği `batch.ts`'e taşındı: her `.in()` ≤ 100 değer (tercih, idempotency, token, durum güncellemeleri), insert'ler ≤ 500 satır, her sorgu/insert hatası loglanır. Okuma hatası gönderimi durdurur (yanlış "kapalı" ya da çift gönderim yerine görünür hata).
3. **md.0 kampanya:** `by_campaign` artık `skipped_count` + `error_message` yazar; hedef > 0 iken 0 gönderimde durum `failed` + neden (`0/829 gönderildi — …`).
4. **md.1 sunucu:** metin token başına `push_tokens.locale`'e göre seçilir (`en` → `_en` alanları, boş alan TR'ye düşer; başlık/gövde ayrı ayrı). `{{değişken}}` iki dilde aynı doldurulur. Expo'ya dile göre iki grup, 100'lük partiler. `by_content`'e isteğe bağlı `title_en`/`body_en`.
5. **md.1 migration (yalnız dosya):** `push_tokens.locale` (`not null default 'tr'`, check tr|en), şablon `_en`, kampanya `title_en/body_en/skipped_count/error_message`, 19 şablonun İngilizcesi; rollback ayrı.
6. **md.1 uygulama:** token kaydı `locale` yazar (I18nProvider ile aynı çözüm: tercih → cihaz dili); `App.tsx` `useT().lang` değişince `syncPushLocale` bu cihazın token satırını günceller. Kolon canlıda yoksa kayıt kolonsuz tekrarlanır (kayıt asla düşmez).
7. **md.1 panel:** `admin-panel` kampanya formuna isteğe bağlı "İngilizce başlık / metin" (ayrı repo, dal `g55/kampanya-en`, **push edilmedi**; yama kopyası `docs/night/g55/admin-panel-g55-kampanya-en.patch`).
8. **md.2:** `version: '1.1.1'`, `runtimeVersion: '1.1.0'` (sabit). `@expo/fingerprint` ile doğrulandı: native fark yok.
9. Kontroller hepsi geçti: hygiene + tsc · unit 1423/1423 · jest 884/884 · expo export iOS + Android.
10. Ekran görüntüleri: `docs/night/g55/` (panel formu boş/dolu/dar ekran + kayıt yükleri). Mobilde görsel değişiklik yok.

## Commit
| Repo / dal | Commit | İçerik |
|---|---|---|
| kcal-mobile `release/1.1.0` | `c18670f` | send-notification md.0 parçalı sorgu + md.1 dile göre metin, migration + rollback, testler |
| kcal-mobile `release/1.1.0` | `04660d6` | uygulama: token kaydına `locale`, dil değişince güncelleme |
| kcal-mobile `release/1.1.0` | `16d4725` | 1.1.1 + sabit runtime 1.1.0 |
| kcal-mobile `release/1.1.0` | `4559f93` | 1.1.1 sürüm testi + NeonBorder eğrisi motion token'ına (önceden kırık test) |
| kcal-mobile `release/1.1.0` | (LOG commit'i) | bu LOG + ekran görüntüleri + panel yaması |
| kcal-mobile `release/1.1.0` | (son) | `docs/night/G55-S1-DONE` |
| admin-panel `g55/kampanya-en` (yerel, worktree `~/dev/kcal-mobile/.claude/worktrees/g55-panel`) | `8c139ff` | kampanya formu İngilizce alanlar |

**Backend cherry-pick (CLAUDE.md kuralı):** `c18670f` (supabase/) main'e de cherry-pick edilmeli — `main`'e commit bu oturumda yasak olduğu için yapılmadı (SORULAR 1).

## md.0 ayrıntı — son 30 gün `notification_sends` (canlı, salt okuma)
| Akış | Gözlem |
|---|---|
| Kampanya "Yeni Kcalculate geldi 🎉" (14 Kas, `3b63a9f1…`) | 20:26:02 → 829 `skipped` ("marketing disabled by user", tek insert); 20:31 → 363 `sent` (`by_content` partileri). Kampanya satırı sonradan `target 363 / sent 367` olarak güncellenmiş. |
| `inactive_user` (haftalık, Pzt 11:00) | 19 Eki 207 sent / 269 skipped · 26 Eki 94 / 108 · 2 Kas 12 / 26 · 9 Kas 255 / 311. **Etkilenmiyor:** `push-inactive-user` cron'u kullanıcı başına `trigger_behavioral_push` → `by_template_single` (tek UUID). |
| `cart_abandoned`, `order_*`, `order_feedback`, `payment_failed` | Kullanıcı başına çağrı; günlük 1–10 gönderim, normal. Atlananlar tercih/token kaynaklı. |
| Diğer kampanyalar | 21 Eki 3, 11 Kas 3, 17 Eki 4 (küçük hedef, sorun yok). |
| Risk | Yalnız çok kullanıcılı tek çağrılar (`by_campaign`, büyük `user_ids` listeli `by_template`/`by_content`) etkileniyordu. 566 UUID'lik bir liste (~22 KB adres) geçer, 829 (~32 KB) geçmiyordu. |

## md.2 ayrıntı — runtime kararı
- Önceki politika `runtimeVersion: { policy: 'appVersion' }` → 1.1.1 build'i runtime **1.1.1** olurdu; o zaman tek `eas update` 1.1.0 kullanıcılarına ya da 1.1.1'e gider, ikisine birden gitmezdi.
- **KARAR:** sabit `runtimeVersion: '1.1.0'`. Gerekçe: 1.1.0 binary'sinin runtime'ı zaten "1.1.0" (appVersion çözümü); 1.1.1 aynı native tabanı taşıyor.
- **Doğrulama (`@expo/fingerprint`, `git archive` kopyalarıyla, aynı node_modules):**
  - 1.1.0 build tabanı `89f92c9` (G41-S1, iOS 32 / Android 11) ↔ `HEAD` (`04660d6`): tek fark `file:eas.json` (yeni `submit.internal` profili — binary'e girmez). package.json / package-lock / modules / app.config.js değişmemiş.
  - `HEAD` ↔ 1.1.1 ayarı: tek fark `expoConfig` → `version 1.1.0→1.1.1`, `runtimeVersion {policy:appVersion} → "1.1.0"` (`expo config --type public` farkı).
- **Uyarı:** ileride yeni yerel paket/plugin eklenirse `runtimeVersion` mutlaka artırılmalı (app.config.js'te not var).

### İlter'in çalıştıracağı komutlar (bu oturumda ÇALIŞTIRILMADI)
```
# 0) Önce migration (aşağıda), sonra send-notification deploy
# 1) Build numarası: eas.json appVersionSource=remote + autoIncrement — kontrol:
eas build:version:get
# 2) Build
eas build --profile production --platform all
# 3) Gönderim
eas submit --profile production --platform ios
eas submit --profile production --platform android
# 4) Sonraki OTA'lar hem 1.1.0 hem 1.1.1'e gider (runtime 1.1.0):
eas update --channel production --message "…"
```

## CANLIYA UYGULANACAK migration'lar
1. `supabase/migrations/20261116100100_g55_notification_locale.sql` (rollback: `supabase/rollbacks/20261116100100_g55_notification_locale_rollback.sql`). İdempotent. **send-notification deploy'undan ve uygulama OTA'sından ÖNCE.** (Sıra bozulursa da kırılmaz: fonksiyon kolonsuz çalışır — herkes TR, sayaç alanları düşürülür; uygulama `locale`'siz tekrar kaydeder; panel boş İngilizce alanları göndermez.)

## DEPLOY GEREKİR
1. `supabase functions deploy send-notification` (yeni dosyalar: `batch.ts`, `locale.ts`; `deno check` temiz).
2. Uygulama: OTA (`eas update --channel production`) ya da 1.1.1 build — `locale` yazımı ve dil senkronu için. Eski sürümler `tr` kalır.
3. admin-panel: `g55/kampanya-en` dalı (yerel; push ve main merge İlter onayıyla — admin-panel main merge onaysız yasak).

## Kontroller
| Kontrol | Sonuç |
|---|---|
| hygiene + tsc | geçti (hygiene OK, tsc 0 hata) |
| unit (`npm run test:unit`) | 1423 / 1423 geçti |
| jest | 127 suite, 884 / 884 geçti |
| expo export iOS | geçti (3460 modül) |
| expo export Android | geçti (3467 modül) |
| `deno check supabase/functions/send-notification/index.ts` | geçti |
| admin-panel `eslint src/pages/admin/Campaigns.jsx` | temiz |

Yeni testler: `src/lib/notify/__tests__/sendNotificationBatch.test.ts` (829 kullanıcılı sahte istemci: tercih/token sorguları 9 parça × ≤100, insert ≤500, update ≤100; 100'den uzun `.in()` 400 dönen istemcide kimse yanlış atlanmıyor; hata loglama; kampanya sonucu; dil seçimi + alan bazında geri düşme; dile göre iki grup; kolon yokken TR; migration içeriği) · `src/core/push/__tests__/pushLocale.test.ts`. Güncellenen: `finPush.test.ts`, `marketingOptIn.test.ts` (kod `batch.ts`'e taşındı).

## Ekran görüntüleri (`docs/night/g55/`)
- `panel-kampanya-en-bos.png` — yeni kampanya formu, İngilizce alanlar boş.
- `panel-kampanya-en-dolu.png`, `panel-kampanya-en-dolu-dar.png` (390 px) — iki dil dolu.
- `panel-kampanya-en-kayit-yuku.png` — "Taslak Kaydet" yükü: `title_en` + `body_en`.
- `panel-kampanya-en-kayit-yuku-yalniz-baslik.png` — yalnız İngilizce başlık: `body_en: null` (gönderimde TR'ye düşer).
- Yöntem: panel bileşeni sahte supabase istemcisiyle yerel vite + headless Chrome (ağ yok, `.env` okunmadı). Düzenek: `docs/night/g55/panel-onizleme/`.
- Mobil: görsel değişiklik yok (yalnız token satırına dil). Simülatörde uygulama kurulu değildi; iOS derlemesi bu iş için gereksiz görülüp yapılmadı.

## HIG / erişilebilirlik (panel)
- Yeni alanlar `<label htmlFor>` ile bağlı (ekran okuyucu), `lang="en"` (doğru telaffuz), mevcut form sınıfları ve sayaçlarla aynı dil. Web paneli olduğu için dokunma hedefi mevcut girdilerle aynı (≥ 44 px yükseklik).

## KARAR
- Okuma sorgusu (tercih/idempotency/token) hatası → gönderim **durur** (throw). Gerekçe: eski "boş say ve atla" davranışı 829 kişiyi sessizce dışarıda bıraktı; kısmi veriyle göndermek ise tercihi kapalı kullanıcıya pazarlama göndermek ya da çift gönderim demek.
- Yazma (insert/update) hatası → loglanır, `results.errors`'a eklenir, gönderim sürer (push zaten gitmiş olabilir; geri alınamaz).
- `notification_sends` satırlarına token dilinde gönderilen metin yazılır (atlananlar TR).
- `.in('id', …)` durum güncellemeleri de 500 → 100 (PATCH adresi de aynı sınıra tabi).
- Panel İngilizce alanları yalnız doluysa (ya da satırda kolon varsa) gönderir → migration'dan önce de kayıt bozulmaz.
- **Önceden kırık test:** `noLocalMotionTokens` başlangıç commit'i `04eaa9a`'da (NeonBorder neon kenar) kırıktı — yerel `Easing.inOut(Easing.sin)`. Eğri aynen `PAYWALL_MOTION.neonBreathEasing` token'ına taşındı (görünüm/süre değişmedi). `storeConfig.test.ts` sürüm/runtime beklentisi 1.1.1 / `'1.1.0'` olarak güncellendi.
- Görev metni "hiçbir `notification_sends` satırı yazılmadı" diyordu; canlıda 829 `skipped` satırı var (tek POST insert başarılı). Asıl hata tercih sorgusunun 400'ü — LOG'a olduğu gibi yazıldı.

## SORULAR
1. `c18670f` (supabase/ değişikliği) main'e cherry-pick: CLAUDE.md gereği gerekli, ama bu oturumda main'e commit yasak — siz yapar mısınız?
2. admin-panel `g55/kampanya-en` dalı yerelde; push + merge sizde. (Kampanya detay penceresine `skipped_count` / `error_message` göstermek de istenirse küçük bir ek.)
3. 14 Kas kampanya satırı `target 363 / sent 367` gösteriyor (elle düzeltilmiş görünüyor); gerçek hedef 829. Düzeltmek isterseniz canlı veri yazımı gerekir — yapılmadı.
4. `fn_push_social_notification` / destek-değerlendirme yanıtları `by_content` ile sabit TR metin gönderiyor; İngilizce karşılık istenirse tetikleyicilere `title_en`/`body_en` eklenebilir (fonksiyon artık destekliyor).
