# G2-S1-LOG — Güvenlik oturumu (gece-2)

## ÖZET (10 satır)
1. **Dal:** `night2/security` (worktree `.claude/worktrees/g2-s1`, feat/social-login'den).
2. **Yapıldı:** Supabase security + performance advisor'ları çekildi; 10 RLS'siz tablo + 9 anon SECURITY DEFINER fn + 19 mutable search_path analiz edildi.
3. Her tablo/fonksiyonun kod kullanımı src/, admin-panel/, branch-panel/, supabase/functions/ taranarak role bazında kanıtlandı (3 alt-ajan).
4. **Migration 0100:** 10 tabloya "erişim yok" RLS politikası (davranış aynı, advisor kapanır). + rollback.
5. **Migration 0200:** `validate_coupon`/`en_iyi_yorumlar`/`campaign_targets_me` anon'dan kaldırıldı; 3 SECURITY DEFINER trigger'a search_path sabitlendi. + rollback.
6. **4 migration dosyası da YALNIZCA YAZILDI, uygulanmadı, staging'de test edilmedi** (gece kuralı).
7. **Ek denetim (rapor):** storage bucket'ları, edge fn JWT, Paynkolay/Adisyo HMAC (OK), Tosla imza yok (kapalı), git'te service_role JWT (YÜKSEK), gitignore (OK).
8. **En kritik bulgu:** git geçmişinde service_role JWT → `tools/adisyo-prices/setup-adisyo-trigger.sql:32` (commit 2c75997) → anahtar rotasyonu gerek.
9. **Kalan:** campaign_has_targets kullanımı doğrulanmalı; kalan ~16 mutable search_path fn için canlıdan imza alınıp takip migration'ı.
10. **İlter sabah:** (1) service_role rote et, (2) 0100 çalıştır, (3) 0200 çalıştır, (4) campaign_has_targets doğrula — detay `G2-S1-SECURITY.md` "SABAH" bölümü.

---

## Detaylı ilerleme

**Kurulum:** worktree `.claude/worktrees/g2-s1`, dal `night2/security` (feat/social-login HEAD 06483b7). RULES.md okundu, uyuldu. Ana checkout'a dokunulmadı.

**Advisor (supabase-prod MCP, read-only):**
- security: `rls_enabled_no_policy` 10; `anon_security_definer_function_executable` 9; `authenticated_...` 37; `function_search_path_mutable` 19; `auth_leaked_password_protection` 1.
- Not: Doğrudan `execute_sql` auto-mode sınıflandırıcı tarafından reddedildi; tüm şema bilgisi repo migration'larından ve S1-SCHEMA_DUMP'tan alındı (daha temiz, prod'a yazma riski yok).

**Kod haritalama (3 Explore alt-ajanı):**
- 10 tablonun tamamı backend-only (yalnız service_role edge fn). `push_notifications` ölü tablo (0 satır, referans yok).
- 9 anon fn'den 6'sı giriş öncesi akışta gerçekten gerekli (menü/sepet/yorum/storage); 3'ü gereksiz → kaldırıldı.
- Audit: Paynkolay + Adisyo callback imzaları sağlam; Tosla imzasız (kapalı); service_role JWT sızıntısı.

**Üretilen dosyalar:**
- `supabase/migrations/20261103000100_security_rls_policies.sql` (+ `_rollback.sql`)
- `supabase/migrations/20261103000200_function_grants.sql` (+ `_rollback.sql`)
- `docs/night/G2-S1-SECURITY.md` (tam rapor + sabah adımları)
- `docs/night/G2-S1-LOG.md` (bu dosya)

**Kontrol:** Yalnızca SQL migration + docs eklendi; mobil/TS veya panel kodu değişmedi (tsc/build kapsamı dışı). Migration'lar hiçbir yere uygulanmadı.

## SORULAR / KARAR GEREKENLER
- **campaign_has_targets(uuid):** Önceki oturum anon'a kasıtlı verdi; grep'te doğrudan çağrı yok. Kullanılmıyorsa anon revoke edilebilir — İlter doğrulamalı.
- **Leaked password protection:** Dashboard auth ayarı (ONAYSIZ YASAK) → İlter'in onayı.
- **Git geçmişi temizliği:** service_role rotasyonu sonrası geçmiş temizliği (filter-repo) yapılsın mı? Riskli; önce rotasyon yeterli.
