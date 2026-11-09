// G18-ORTAK #12 — tek ortak fiyat biçimi: "₺" YOK, tutar sonunda "TL".
// G18-S5: TEK KAYNAK `src/lib/money.ts` (`formatPrice` / `formatPriceDelta`); bu dosya
// yalnız Ana sayfa (S2) çağrı biçimini ona bağlayan ince katman.
//   285 → "285 TL" · 285.5 → "285,50 TL" · 1250 → "1250 TL" (nokta ayracı yok)
//   sign: true → "+150 TL". EN aynı ("285 TL", "285,50 TL" — ORTAK #12 "EN aynı").
import { formatPrice as moneyFormatPrice, formatPriceDelta } from '../lib/money';

export function formatPrice(
  value: number,
  opts: { lang?: 'tr' | 'en'; sign?: boolean } = {},
): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return opts.sign ? formatPriceDelta(n) : moneyFormatPrice(n);
}
