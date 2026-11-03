# G11-S1-LOG — Son sunucu düzeltmeleri + yeni RPC'ler (opus)

## 10 satır özet
1. Dal `night11/server` (taban `night10/release`), worktree `.claude/worktrees/g11-s1`. 10 maddenin tamamı G11-CONTRACT ile birebir; migration YALNIZ dosya.
2. 7 sunucu maddesi TEK migration: `supabase/migrations/20261105000300_g11_fixes.sql` (+ `supabase/rollbacks/...` + `feed_rls_test.sql` T28–T33). G6-APPLY'a **#16** (EN SON, #15'ten sonra).
3. Madde 1 — ayrılmış kullanıcı adları: `handle_is_reserved()` (tam eşleşme 23 ad + `kcal`/`eatkcal` marka öneki) sunucuda; `claim_handle`/`check_handle` çağırır; istemci `handle.ts` birebir; ortak vektör `handle.reserved.test.ts` + `feed_rls_test.sql` T28. Noktalı türev (`kcal.official`) serbest.
4. Madde 2 — 20 sosyal tabloda `revoke truncate, trigger, references from anon, authenticated` (idempotent DO-loop, `to_regclass` ile var olanlar). Veri erişimi (RLS + select/ins/upd/del grant) değişmez.
5. Madde 3 — post-media `creator_*`/`writer_*` çifti tek `writer_*` setine indirildi (zincirde #4→#12→#14 ikisini birlikte bırakıyordu). Davranış aynı; okuma (#15) dokunulmadı.
6. Madde 4 — `update_my_post(p_post,p_body)→{ok,status}` (yalnız yazar, sınır 1000=create_post); yayındaki gövde değişirse `pending`+`moderation_queue`. `posts_guard_protected_cols`'a gövde dalı → doğrudan PostgREST UPDATE açığı kapandı. İstemcide doğrudan `posts` UPDATE grep'i TEMİZ (ENTEGRASYONA yok).
7. Madde 5 — `search_products(p_q,p_limit)` SECURITY INVOKER (products SELECT herkese açık — 20261017095259). p_q≥2, ≤20. Kolon eşlemesi repodan (src/lib/categories.ts:102): image_url=`img`, kcal=`calories`, protein_g=`protein`, carbs_g=`carbs`, fat_g=`fats`, aktiflik=`is_available`. **Canlı doğrulama GEREKLİ** (bkz. SORULAR + CANLI-SIRA).
8. Madde 6 — `feature_flag_audit` (RLS: yalnız admin okur) + `admin_list_flags`/`admin_set_flag`/`admin_flag_unlock`/`admin_find_user` (admin_allowlist deseni). `admin_set_flag` geçersiz anahtar/yüzde → hata, her değişiklik audit satırı.
9. Madde 7 — `yeni_kabuk` satırı (enabled=false, rollout 0, min_app_version '1.1.0'). `get_my_features` min_app_version'ı ZATEN uyguluyor (satır 182 `_ff_version_gte`); istemci `FlagsProvider.tsx:76` `p_app_version=Constants.expoConfig.version` gönderiyor → düzeltme GEREKMEDİ, yalnız satır.
10. Kontrol: `npx tsc --noEmit` 0; `npm run test:unit` **407/407** (404 + yeni 3). Migration/SQL testi staging'de KOŞULMADI (gece kuralı + canlı okuma bloklandı — yalnız dosya). Son commit `docs/night/G11-S1-DONE`.

## Madde → yer → test eşlemesi
| # | Madde | Yer | Test |
|---|-------|-----|------|
| 1 | Ayrılmış adlar | `g11_fixes.sql §1` (`handle_is_reserved`+claim/check), `handle.ts` | `handle.reserved.test.ts`, `feed_rls_test.sql` T28 (ortak vektör) |
| 2 | Yetki sıkılaştırma | `§2` (DO-loop revoke) | `feed_rls_test.sql` (canlı doğrulama sorgusu CANLI-SIRA (b)/2) |
| 3 | Yinelenen storage politikaları | `§3` (writer_* tek set) | T30 (creator_*=0, writer_*=3) |
| 4 | Gövde yeniden denetim | `§4` (`update_my_post` + guard gövde dalı) | T29a (RPC), T29b (doğrudan UPDATE), T29c (status guard regresyon) |
| 5 | `search_products` | `§5` (SECURITY INVOKER) | T31a (<2 boş), T31b (aktif filtre + kolon eşlemesi, best-effort seed) |
| 6 | Bayrak yönetimi RPC'leri | `§6` (4 RPC + `feature_flag_audit`) | T33a (non-admin red), T33b–g (yüzde/anahtar/set+audit/list/unlock/find) |
| 7 | `yeni_kabuk` satırı | `§7` (seed) + get_my_features doğrulandı | T32 (varsayılanlar) |

## Önemli kararlar / notlar
- **Ayrılmışlık kuralı (G11-CONTRACT line 49):** (a) tam eşleşme 23 ad; (b) `^(kcal|eatkcal)[a-z0-9]` (marka öneki + harf/rakam). `kcal` öneki `kcalculate`/`kcalai`'yı kapsar. Noktalı/alt çizgili türev (`kcal.official`, `kcal_`) ayrılmış DEĞİL (önekten sonra ayraç). `profiles` tablosuna CHECK EKLENMEDİ — canlıda grandfathered kurumsal satırları kırmamak için; kapı yalnız yeni sahiplenme (claim_handle) + kontrol (check_handle).
- **claim_handle idempotentlik sırası:** rezerve kontrolü, "aynı kullanıcı aynı handle" idempotent dalından SONRA — grandfathered hesap kendi adını güncelleyebilsin; yeni sahiplenmede rezerve reddedilir. `check_handle` de sahibi zaten o değilse rezerve sayar.
- **check_handle dönüşü `available` anahtarıyla korundu** (istemci `useHandleClaim.ts:67` onu okuyor); rezerve için `{available:false, reason:'reserved'}`.
- **Madde 3 hangi set:** g8 `writer_*` kasıtlı yeniden adlandırmaydı; g9 `creator_*`'ı kazara geri getirdi. `writer_*` tutuldu, `creator_*` kaldırıldı (idempotent yeniden oluşturma → uygulama sırasından bağımsız).
- **Madde 4 çift ekleme yok:** `update_my_post` `app.post_rpc=on` set eder → guard'ın gövde dalı (yalnız `not v_post_rpc`) çalışmaz; kuyruğu RPC kendi ekler. Doğrudan UPDATE'te (bayrak yok) guard dalı devreye girer. İki yol da `on conflict do nothing` (PK target_type,target_id).
- **Madde 5 RLS kararı:** products SELECT herkese açık (20261017095259: "Okuma açık kalıyor") → SECURITY INVOKER; kolon beyaz listesi dönüş şeklinde zaten var, DEFINER gerekmedi.
- **Madde 6 `admin_set_flag` semantiği:** bayrağın TÜM yapılandırmasını set eder — `min_app_version`/`platforms` null = TEMİZLE (panel tam durumu gönderir). Geçersiz anahtar = bayrak yok (yeni bayrak oluşturmaz) → `gecersiz_anahtar`.

## ENTEGRASYONA (S6)
- Yok. İstemcide doğrudan `posts` UPDATE kullanımı grep'lendi (`src/` genel) → **bulunmadı**; madde 4 tetikleyicisi yalnız savunma amaçlı. i18n değişikliği yok (handle `profil.*` anahtarları S4'te mevcut; yeni anahtar eklenmedi).

## SORULAR
1. **`search_products` canlı `products` kolonları:** Canlı okuma harness güvenlik
   sınıflandırıcısı tarafından bloklandı (G6-APPLY'daki ile aynı). Eşleme repodan
   çıkarıldı: `id, name, img, calories, protein, carbs, fats, is_available`
   (`src/lib/categories.ts:102`). Uygulamadan ÖNCE `G11-CANLI-SIRA.md` (a)'daki
   `products` kolon sorgusunu koş; adlar farklıysa (örn. `image_url`/`fat`)
   migration'daki kolon adlarını düzelt. Aktiflik için `is_available=true` seçildi.

## Doğrulama komutları (bu oturumda koşuldu)
```
npx tsc --noEmit                 # 0 hata
npm run test:unit                # 407 pass / 0 fail (404 + G11 reserved 3)
# migration/feed_rls_test.sql → staging'de KOŞULMADI (gece kuralı; yalnız dosya)
```

## Commit'ler (night11/server)
- `(c1)` fix(g11-istemci): ayrılmış kullanıcı adları — handle.ts + handle.reserved.test
- `(c2)` fix(g11-backend): 20261105000300_g11_fixes (7 madde) + rollback
- `(c3)` test(g11): feed_rls_test T28–T33
- `(c4)` docs(gece-g11-s1): G6-APPLY #16 + G11-CANLI-SIRA + G11-S1-LOG
- `(c5)` docs(gece-g11-s1): G11-S1-DONE

İlgili: [G6-APPLY.md](./G6-APPLY.md), [G11-CANLI-SIRA.md](./G11-CANLI-SIRA.md),
[G9-S1-LOG.md](./G9-S1-LOG.md), [G10-S1-LOG.md](./G10-S1-LOG.md).
