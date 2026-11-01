# S1 — Veri katmanı · LOG

> Bu dosyanın başı iş bitince 10 satırlık özetle güncellenecek.

## Çalışma ortamı
- Dal: `night/s1-data` (feat/social-login'den, worktree: `.claude/worktrees/s1-data`)
- Canlı Supabase (`xtjakvinklthlvsfcncu`) salt-okunur, yalnızca `supabase-prod` MCP ile.
- **staging MCP oturumda YOK** → migration'lar yalnızca dosya olarak yazıldı, hiçbir yere uygulanmadı/test edilmedi.

## İlerleme

### 1. Repo ↔ canlı senkronu — TAMAM
- Canlıda olup repoda olmayan **20 migration** (20–27 Ekim) canlı migration geçmişinden (`supabase_migrations.schema_migrations`) kurtarılıp `supabase/migrations/` altına yazıldı.
- Repoda olup canlı geçmişinde olmayan **11 dosya** aslında aynı mantıksal migration'ların **farklı timestamp'li** kopyaları (db push yeniden damgalamış) — detay DB_AUDIT §1.
- Canlıda olup repoda olmayan **7 edge function** çekildi: `free-order-complete`, `macro-expiry`, `env-check`, `tosla-payment-init`, `tosla-callback`, `social-upload`, `reels-upload-url`. Inline secret yok (tümü `Deno.env.get`; social/reels'teki `TOKEN_SHA256` tek yönlü hash, commit'lenebilir).

### 2. Şema denetimi — (devam)
### 3. Düzeltme migration'ları — (devam)
### 4. Tracking şeması taslağı — (devam)
### 5. main ↔ feat/social-login ayrışması — TAMAM (tespit)
- Cherry-pick hariç main'de eksik **38 backend commit** tespit edildi. Detay DB_AUDIT §6.

## SORULAR
- (henüz yok)
