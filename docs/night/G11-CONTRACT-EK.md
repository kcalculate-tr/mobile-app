# G11-CONTRACT "Ek" — `search_products` kolon eşlemesi

> S1 eşlemeyi çıkardı; S6 sözleşmenin "Ek" başlığına taşıdı. `.claude/night/G11-CONTRACT.md`
> gitignored + izole worktree dışı olduğundan doğrudan düzenlenemedi; sevk edilen
> (tracked) tek kaynak bu dosya + [G11-CANLI-SIRA.md](./G11-CANLI-SIRA.md) satır 44–50.

İstemcinin (S3) güvendiği dönüş şekli ↔ canlı `products` tablosu kolon adları
(repodan, `src/lib/categories.ts:102`):

| Dönüş alanı | `products` kolonu |
|---|---|
| `id` | `id` |
| `name` | `name` |
| `image_url` | `img` |
| `kcal` | `calories` |
| `protein_g` | `protein` |
| `carbs_g` | `carbs` |
| `fat_g` | `fats` |
| (aktiflik filtresi) | `is_available = true` |

Kurallar: `p_q` ≥ 2 karakter, en fazla 20 sonuç, yalnız authenticated,
`SECURITY INVOKER` (products SELECT herkese açık — `20261017095259`). Migration:
`supabase/migrations/20261105000300_g11_fixes.sql §5`.

**Canlı doğrulama GEREKLİ** — uygulamadan önce `docs/night/G11-CANLI-SIRA.md` (a)'daki
`products` kolon sorgusunu koş; adlar farklıysa (örn. `image_url` / `fat`)
migration'daki kolon adlarını düzelt.
