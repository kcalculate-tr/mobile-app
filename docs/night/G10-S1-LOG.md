# G10-S1-LOG — Son güvenlik düzeltmeleri (test ortamı bulguları 1–6)

## 10 satır özet
1. Dal `night10/release` (taban `night9/release`), worktree `.claude/worktrees/g10-s1`.
2. 6 maddenin tamamı TEK migration: `supabase/migrations/20261105000200_g10_fixes.sql` (+ rollback `supabase/rollbacks/...` + `feed_rls_test.sql` senaryoları T22–T27). G6-APPLY'a **#15** (EN SON) eklendi.
3. Madde 1 — `reserve_ai_scan` idempotency anahtarı araması `user_id = auth.uid()` ile sınırlandı; başkasına ait anahtar → `baskasinin_anahtari` hatası (kota aşımı kapandı). `release_ai_scan` zaten yalnız kendi rezervasyonunu bırakıyor (doğrulandı, değişiklik yok).
4. Madde 2 — `post_media_read` geniş `public` SELECT kaldırıldı; listeleme yalnız sahip (`posts/{uid}/`) + moderatör/admin. Kova `public` kalır (CDN URL RLS'siz çalışır); istemci/panel storage LİSTELEME kullanmıyor (grep ile doğrulandı) → görünür içerik bozulmaz.
5. Madde 3 — `report_content` görünürlük kapısı (post/comment/day_card/user) + `comment` desteği + günde 50 şikayet sınırı; görülemeyen hedef → `bulunamadi` (varlık yoklanamaz). Görünürlük limitten ÖNCE.
6. Madde 4 — `mod_resolve_report` çözülen post/comment için `moderation_queue` satırını `done` yapar (cron yeniden denemesin); dismiss→published (post+comment, G9 3f) doğrulandı ve korundu.
7. Madde 5 — `post_comments_guard_protected_cols` BEFORE UPDATE trigger (status/author_id/post_id/parent_id koruması, `app.post_rpc`); `delete_my_comment` bayrağı açar. posts (G9 3c) ve profiles zaten trigger'la korunuyordu (yeterli, dokunulmadı).
8. Madde 6 — `get_user_day_progress` yetki kapısı yalnız `auth.uid()` DOLUYKEN uygulanır; null-auth (rolsüz/servis/definer iç çağrı) kapıyı atlar (kırılmaz). EXECUTE zaten authenticated/anon/public'ten revoke'lu (sızıntı yok, savunma amaçlı iç kapı).
9. Kontrol: İSTEMCİ DEĞİŞİKLİĞİ YOK (yalnız sunucu/migration/docs/test) → tsc/unit/expo export gerekmedi. Bütün düzeltmeler bayrak-bağımsız sunucu güvenliği; davranış 1.0.7 akışıyla uyumlu (görünür içerik eskisi gibi, görünmez içerik artık yoklanamaz).
10. Migration/test staging'de KOŞULMADI (gece kuralı — yalnız dosya). Uygulamadan önce `feed_rls_test.sql` (27 senaryo) staging'de `psql -f` ile doğrulanmalı. **SORULAR yok.**

## Düzeltme → test eşlemesi
| # | Düzeltme | Yer | Test |
|---|----------|-----|------|
| 1 | reserve_ai_scan anahtar sahipliği | `20261105000200_g10_fixes.sql` §1 | `feed_rls_test.sql` T22 (B rezerve → C aynı anahtar red + kota korundu) |
| 2 | post-media listeleme yalnız sahip+moderatör | §2 (`post_media_read` SELECT) | T23 (yabancı 0 / sahip kendi / moderatör hepsi) |
| 3 | report_content görünürlük + comment + 50 sınır | §3 | T24a (engelli→bulunamadi), T24b (pending→bulunamadi), T24c (görünür post+comment ok), T24d (50 sınır) |
| 4 | mod_resolve_report + moderation_queue done | §4 | T25 (dismiss → post+comment published + queue done) |
| 5 | post_comments.status guard | §5 (trigger + delete_my_comment) | T26a (doğrudan status red), T26b (delete_my_comment→removed) |
| 6 | get_user_day_progress null-auth kapısı | §6 | T27a (görülemeyen→yetkisiz), T27b (null-auth→sonuç döner), T27c (self ok) |

## Önemli kararlar / notlar
- **Görünürlük limitten önce (madde 3):** görülemeyen hedef için `cok_fazla_sikayet` bile sızdırılmaz — önce `bulunamadi`. Böylece 50 sınır yalnız gerçekten görülebilir hedeflerde devreye girer.
- **`app.post_rpc` yeniden kullanıldı (madde 5):** posts guard'ıyla aynı işlem-yerel bayrak; `mod_resolve_report` (zaten açıyor) ve `delete_my_comment` (bu oturumda eklendi) comment status değişimini guard'dan geçirir. Yazarın DOĞRUDAN UPDATE'i bayraksız → engellenir.
- **Madde 6 incelik:** G9 3h kapısı `p_uid is distinct from auth.uid()` ile başlıyordu; `auth.uid()` NULL olunca (`distinct from null` = true) rolsüz/servis definer çağrıları hatalı reddedilebilirdi. Kapıya `auth.uid() is not null` guard'ı eklendi; moderatör/admin istisnası (G9) korundu.
- **Test rol yönetimi:** T22–T24 `authenticated` rolünde (RPC grant + RLS gerçekçi); T25–T27 `reset role` (sahip) — RLS baypas ile content_reports/queue/post_comments okunur, guard trigger'ları yine `request.jwt.claims` rolünü ve `auth.uid()`'i okur (davranış aynı). T25 mod_resolve için `auth.uid()=M` jwt'den gelir.

## Bayrak-bağımsızlık / geriye uyumluluk
- Hiçbiri yeni bayrak eklemez; hepsi mevcut sunucu akışının güvenlik sıkılaştırması.
- Madde 2: kova `public` kaldığından yayımlanmış görseller CDN public URL'i ile aynen servis edilir; yalnız anonim/yabancı LİSTELEME kapandı.
- Madde 4/5: moderate-content edge fn (`service_role`) ve cron (rolsüz) guard'lardan muaf → yayın/moderasyon akışı bozulmaz.
- Madde 6: EXECUTE zaten authenticated'a kapalı; kapı yalnız iç definer çağrılar için savunma — null-auth guard'ı o çağrıları KORUR.

## Commit'ler (night10/release)
- `60efef4` fix(g10-backend): 20261105000200_g10_fixes (6 madde) + rollback
- `56e8dba` test(g10): feed_rls_test T22–T27 (6 maddeye senaryo + fixture)
- `(bu commit)` docs(gece-g10-s1): G6-APPLY #15 + G10-S1-LOG

## İlter'in yapacakları
- Uygulama: `docs/night/G6-APPLY.md` #15 EN SON (tüm #1–#14 sonrası), elle, tek dosya. Geri alma: `supabase/rollbacks/20261105000200_g10_fixes_rollback.sql`.
- Staging doğrulama: `supabase/tests/feed_rls_test.sql` (27 senaryo, `BEGIN…ROLLBACK`) `psql -f` ile koş. T22–T27 ek tohumlar (ai_scan/storage.objects/moderation_queue) dosya içinde; FK için A/B/C/D/M/F Auth kullanıcıları gerekir.
- İstemci değişikliği yok → yeni binary/OTA gerektirmez; yalnız DB migration.
