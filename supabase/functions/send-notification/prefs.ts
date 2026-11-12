// G20-S3 md.6 (B-11 / 6563 ETK md.6) — kategori açık mı? Saf (Deno + node testi).
// Tercih satırı YOKSA: pazarlama KAPALI (açık onay gerekir), diğer kategoriler açık
// (bugünkü davranış). Satır varsa `<kategori>_enabled` değeri.
export type Category = 'transactional' | 'marketing' | 'reminder' | 'behavioral'

export function kategoriAcikMi(prefs: Record<string, unknown> | undefined | null, category: Category): boolean {
  if (!prefs) return category !== 'marketing'
  return Boolean(prefs[`${category}_enabled`])
}
