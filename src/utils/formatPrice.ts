// G18-ORTAK #12 — tek ortak fiyat biçimi: "₺" YOK, tutar sonunda "TL".
//   285 → "285 TL" · 285.5 → "285,50 TL" · 1250 → "1250 TL" (nokta ayracı yok, Tur 26e e3)
//   sign: true → "+150 TL" / "-20 TL". EN de aynı ("285 TL"); EN ondalık ayırıcı ".".
export function formatPrice(
  value: number,
  opts: { lang?: 'tr' | 'en'; sign?: boolean } = {},
): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  const whole = Math.abs(abs - Math.round(abs)) < 0.005;
  const body = whole
    ? String(Math.round(abs))
    : abs.toFixed(2).replace('.', opts.lang === 'en' ? '.' : ',');
  const sign = n < 0 ? '-' : opts.sign && n > 0 ? '+' : '';
  return `${sign}${body} TL`;
}
