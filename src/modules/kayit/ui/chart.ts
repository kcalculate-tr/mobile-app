// G46-S1 md.1 — L2 kilo tahmini grafiği geometrisi (saf; tsx --test).
/**
 * G46 md.1 — Kilo tahmini çizim alanı. Uç noktaların (başlangıç dairesi r 6, hedef dairesi r 7 + 2,5 pt kenar) ve
 * 3 pt çizginin SVG sınırında kırpılmaması için her kenarda iç boşluk: sağ/üst/alt = hedef yarıçapı + kenar
 * kalınlığı (9,5 pt), sol = başlangıç yarıçapı + çizgi kalınlığı (9 pt). Bant ±14 pt da alanın içinde kalır.
 * Saf: genişlik/yükseklik → koordinatlar (testli).
 */
export const WEIGHT_CHART = { h: 110, startR: 6, endR: 7, endStroke: 2.5, line: 3, band: 14 } as const;
export function weightChartGeometry(w: number, down: boolean, h: number = WEIGHT_CHART.h): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  line: string;
  band: string;
  pad: number;
  padL: number;
  h: number;
} {
  const C = WEIGHT_CHART;
  const pad = C.endR + C.endStroke; // sağ / üst / alt
  const padL = C.startR + C.line; // sol
  const x0 = padL;
  const x1 = w - pad;
  // Bant hedef noktada ±14 pt; aşağı inen çizgide bandın alt kenarı, yükselen çizgide üst kenarı da iç boşlukta kalır.
  const y0 = down ? pad : h - pad;
  const y1 = down ? h - pad - C.band : pad + C.band;
  const dx = x1 - x0;
  const cx1 = x0 + dx * 0.35;
  const cx2 = x0 + dx * 0.6;
  const line = `M ${x0} ${y0} C ${cx1} ${y0 + (y1 - y0) * 0.35}, ${cx2} ${y1 - (y1 - y0) * 0.08}, ${x1} ${y1}`;
  const band = `M ${x0} ${y0} C ${cx1} ${y0 + (y1 - y0) * 0.25}, ${cx2} ${y1 - (y1 - y0) * 0.2}, ${x1} ${y1 - C.band} L ${x1} ${y1 + C.band} C ${cx2} ${y1 + 4}, ${cx1} ${y0 + (y1 - y0) * 0.45}, ${x0} ${y0} Z`;
  return { x0, y0, x1, y1, line, band, pad, padL, h };
}
