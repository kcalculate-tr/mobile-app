# G3-S2-LOG — Eski service_role anahtarından kurtulma (hazırlık)

## ÖZET (10 satır)
1. HİÇBİR anahtar değiştirilmedi, migration uygulanmadı; canlı DB yalnız metadata okundu.
2. Dal: `night3/key-rotation` (worktree `.claude/worktrees/g3-s2`, `feat/social-login`'den).
3. Envanter tamam: DB içindeki tüm cron/trigger service_role'u **Vault'tan** okuyor —
   gömülü ham JWT YOK. Vault secret adları: `service_role_key`, `adisyo_service_role_key`.
4. Edge function'lar `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY` env'inden okur (değer repoda yok).
5. Mobil + paneller zaten yeni `sb_publishable_` / env kullanıyor; service_role hiçbir panelde yok.
6. Repo'daki TEK gömülü legacy JWT (`tools/adisyo-prices/setup-adisyo-trigger.sql:32`)
   placeholder ile değiştirildi.
7. Rotasyon migration'ı `supabase/migrations-manual/` altında (db push'a girmez) + rollback.
8. Tam runbook `docs/night/G3-S2-KEY_ROTATION.md` (8 adım + her adımda "ne bozulabilir" + geri dönüş).
9. filter-repo ÖNERİLMEDİ: rotasyon legacy JWT'yi zaten değersizleştirir (repo private).
10. Canlı doğrulandı (gömülü JWT=0) + admin-panel env (`kcal-final` / `VITE_SUPABASE_KEY`) işlendi; runbook hazır.

## Yapılanlar
- Worktree + dal kuruldu; `git worktree add .claude/worktrees/g3-s2 -b night3/key-rotation feat/social-login`.
- Envanter (salt okunur): `git grep` repo geneli + `list_edge_functions` + `list_extensions`
  (pg_cron 1.6.4, supabase_vault 0.3.1, pg_net 0.19.5 kurulu). Repo migration geçmişinden
  cron/trigger→Vault eşlemesi çıkarıldı. Değerler SQL içinde `regexp`/`sed` ile maskelendi.
- `execute_sql` (canlı SELECT) auto-mode politikası tarafından REDDEDİLDİ — ön doğrulama
  sorguları runbook'a "İlter çalıştırır" olarak yazıldı (Bölüm 4).
- `tools/adisyo-prices/setup-adisyo-trigger.sql`: satır 32 ham JWT → placeholder + uyarı.
- `supabase/migrations-manual/20261103T0000_rotate_vault_service_keys.sql` (+`_rollback.sql`):
  placeholder'lı idempotent `UPDATE vault.secrets`, db push KAPSAMI DIŞI.
- `docs/night/G3-S2-KEY_ROTATION.md`: envanter + runbook + doğrulama + SORULAR.

## Test sonucu
- TS/JS değişikliği YOK (yalnız `.sql` + `.md`) → `tsc` tabanı etkilenmedi, çalıştırılmadı.
- Migration'lar UYGULANMADI, staging'de test EDİLMEDİ (RULES gereği). SQL sözdizimi gözden geçirildi.

## Kalanlar / açık noktalar
- Canlı teyit TAMAM (İlter, 2026-11-03): cron.job + fonksiyon gövdelerinde gömülü JWT = 0, tümü Vault'tan.
- admin-panel Vercel env TAMAM: proje `kcal-final`, değişken `VITE_SUPABASE_KEY` (runbook'a işlendi).

## SORULAR
→ `docs/night/G3-S2-KEY_ROTATION.md` Bölüm 6. SORU 1–2 çözüldü; SORU 3–4 açık (opsiyonel, kritik değil).
