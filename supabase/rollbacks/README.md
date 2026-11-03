# Rollback dosyaları

Bu klasördeki `*_rollback.sql` dosyaları `supabase/migrations/` altındaki
migration'ların GERİ ALMA betikleridir. Buraya taşındılar çünkü `supabase db push`
`supabase/migrations/` altındaki her `.sql` dosyasını migration sanıp uygular —
`_rollback.sql` dosyaları orada kalırsa yeni oluşturulan nesneleri aynı push
içinde düşürürdü.

Kural (bkz. `.claude/night/RULES.md`): `supabase/migrations/` altına asla
`_rollback.sql` KOYMA. Geri alma gerektiğinde ilgili dosya buradan elle çalıştırılır.

Dosya adı migration dosyasıyla birebir eşleşir (aynı önek + ad + `_rollback.sql`).
