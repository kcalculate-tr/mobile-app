# G31-S1 — Yayın öncesi son kod düzeltmeleri (11 Kas)

Dal `release/1.1.0` · worktree `.claude/worktrees/g23-s1` · yeni paket YOK · deploy YOK · canlı DB yazma YOK.

## ÖZET
1. Koç tanıtımında "Egzersiz programı yazmaz · Yakında" satırı kalktı (`coach.intro_soon`, `coach.intro_dont2` TR/EN silindi). Grep ile egzersiz için kalan "yakında" ifadeleri de kalktı: Profil'deki "Egzersiz ve fitness rehberi · Yakında" satırı (bayrak arkasındaydı) ve coach-chat isteminde "the fitness guide is coming soon" cümlesi.
2. Koç AI izni metni İlter onaylı: `src/lib/consent/i18n.ts` içindeki "ONAY BEKLİYOR" yorumu kalktı, metin aynı.
3. `demoPrices.ts`: TL 199,99 / 999,99 / 499,99 / 2999,99; USD Fresh $5.99 / $29.99, Balance $12.99 / $59.99. Rozetler hesapla aynı kaldı (%58 / %50).
4. Open Food Facts (ODbL) atfı: Profil › Sözleşmeler'de GeoNames atfının yanında "Ürün verisi: Open Food Facts (ODbL)". Barkod kartındaki kaynak satırı artık "Veri: Open Food Facts (ODbL)".
5. Koç 30 gün saklama: `fn_coach_retention_purge()` her gün 03:30 İstanbul'da çalışan `coach-retention-daily` cron işi olarak kuruluyor. pg_cron yoksa zamanlama atlanır. Migration yalnız DOSYA, rollback dosyası var.
6. delete-account: auth silme başarılı olunca RevenueCat `DELETE /v1/subscribers/{uid}` çağrılıyor. Secret yoksa çağrı atlanıp loglanıyor; hata silmeyi bozmuyor. deno check temiz. Deploy yok.
7. Kontroller: hygiene + tsc 0 hata · unit 1154/1154 · jest 89 dosya / 506 test · deno check (delete-account, coach-chat) · expo export iOS (3249 modül) + Android (3256 modül), hepsi geçti.
Hepsi JS/TS (native değişiklik yok) → OTA ile gider. Sunucu tarafı (cron migration + iki edge function) ayrıca canlıya alınmalı (aşağıda).

## Commit tablosu
| Madde | Commit | Özet |
|---|---|---|
| 1 | `acfaf73` | Koç tanıtımı egzersiz "Yakında" satırı + diğer egzersiz "yakında" ifadeleri |
| 2 | `21bed47` | Koç AI izni "ONAY BEKLİYOR" yorumu kalktı |
| 3 | `ae3aeb9` | demoPrices TL ,99 + USD (+ g27Prices, g22Subscription testleri) |
| 4 | `d83023e` | Open Food Facts (ODbL) atfı: Sözleşmeler + barkod kartı (+ test) |
| 5 | `9aa0999` | `20261112000100_g31_coach_retention_cron.sql` + rollback + test |
| 6 | `fab6445` | delete-account RevenueCat silme (`revenuecat.ts` saf modül + test) |
| 7 | (bu LOG) | Kontroller yukarıda |
| — | DONE | `docs/night/G31-S1-DONE` |

## KARAR
- md.1: "Başka yerde egzersiz 'yakında' kalmasın" maddesi sunucu istemini de kapsıyor. coach-chat `prompt.ts` artık "Say the exercise and fitness guide is coming soon" yerine "Say kindly that this is outside what you do and keep the focus on nutrition" diyor. Bu değişiklik ancak coach-chat deploy edilince canlıya yansır. Profil "Yakında" bloğunda yalnız "Öğün aboneliği" kaldı (`yakinda_satirlari` bayrağı varsayılan KAPALI).
- md.3: Fresh yıllık USD için bir talimat yoktu, $29.99 olarak kaldı. Yalnız aylık $5.99 oldu.
- md.4: Barkod kartında zaten küçük bir kaynak satırı vardı. Yeni satır eklemek yerine metnine "(ODbL)" eklendi.
- md.5: pg_cron'un canlıda olup olmadığı doğrulanamadı (Supabase MCP okuma isteği izin sınıflandırıcısınca reddedildi; `CANLI_SEMA_2026-11-09.md` cron'dan bahsetmiyor). Repodaki önceki cron migration'ları (macro-expiry, adisyo-reconcile) pg_cron'un canlıda olduğuna işaret ediyor. Migration bu yüzden koşullu yazıldı: `cron` şeması varsa iş idempotent kurulur, yoksa yalnız fonksiyon kurulur ve NOTICE düşer. Süre `app_settings.coach_retention_days`'ten okunuyor (vars. 30, en az 1). coach-chat'in çağrı anında yaptığı kendi temizliği de yerinde duruyor.
- md.6: RevenueCat çağrısı `deleteUser` BAŞARILI olduktan SONRA yapılıyor. Böylece auth silme başarısız olursa kullanıcı aboneliğini kaybetmiyor. 404 başarı sayılıyor (kayıt zaten yok). Zaman aşımı 8 sn. Mağaza aboneliği bununla iptal OLMAZ: kullanıcı App Store / Google Play'den iptal eder. Bu davranış önceden de aynıydı.
- HIG: değişen ekranlar yalnız satır kaldırma ve 13 pt ikincil metin ekleme. apple-design skill'i çalıştırılmadı; kod elle denetlendi: yeni metin FinText (Dynamic Type), ikincil renk, var olan atıf satırıyla aynı stil. Dokunma hedefi değişmedi.

## CANLIYA UYGULANACAK
1. `supabase/migrations/20261112000100_g31_coach_retention_cron.sql` (önkoşul: `20261111100100_g24_coach`). Geri alma: `supabase/rollbacks/20261112000100_g31_coach_retention_cron_rollback.sql`.
   - Uygulama sonrası kontrol: `select jobname, schedule from cron.job where jobname = 'coach-retention-daily';`
   - **pg_cron yoksa** (NOTICE "pg_cron yok"): İlter Dashboard › Integrations › Cron'dan günlük bir iş kurar, komut `select public.fn_coach_retention_purge();`, zamanlama `30 0 * * *` (UTC).

## DEPLOY GEREKİR
- Secret (henüz yoksa): `supabase secrets set REVENUECAT_SECRET_API_KEY=<RevenueCat › Project › API keys › Secret key (v1)>` (değer çıktıya yazılmaz). Secret yoksa fonksiyon RevenueCat adımını atlayıp log yazar.
- `supabase functions deploy delete-account`
- `supabase functions deploy coach-chat` (md.1 istem metni)
- OTA (İlter onayıyla): `eas update --branch production --environment production --message "G31"`

## SORULAR
- pg_cron canlıda var mı? Migration iki durumda da güvenli. Yoksa yukarıdaki Dashboard adımı gerekiyor.
- `sub.profile.soon_sub` / `soon_chip` anahtarları artık kullanılmıyor (fitness satırı kalktı). Zararsız oldukları için silinmedi. Temizlensin mi?
