// G53/G54 → 15 Kas (İlter: "olmayacaksa yapmayalım, olacaksa düzgün yap") — seçili plan kartı neon kenarı SAF kuralları
// (RN importu YOK → node:test). Bileşen: ./NeonBorder.tsx.
//
// Dolaşan SVG ışık kaldırıldı: kart kenarını cihazda birebir izlemedi (köşelerde kopuk şerit, kart zemininin altında
// kalan parçalar). Yerine kartın KENDİ kutusuna çizilen sabit neon tüp: 2 pt lime kenar + yerel `boxShadow` (yeni
// mimari, RN ≥ 0.76; iOS + Android) ile dışa doğru yumuşak hale ve içe ince ışıma. Kutu kartın kendisi olduğu için
// hizalama kayamaz. Canlılık için halenin opaklığı yavaşça "nefes alır" (2,4 sn); azaltılmış harekette sabit.

/** Seçim değişince eski karttan yeni karta geçiş (ms, opaklık). */
export const NEON_SWITCH_MS = 250;
/** Hale nefesi: bir yarım tur (ms) — ileri-geri tekrar → tam döngü 2 × bu süre. */
export const NEON_BREATH_MS = 1600;
/** Nefeste halenin en düşük opaklığı (en yüksek 1). */
export const NEON_BREATH_MIN = 0.55;
/** Neon kenar kalınlığı (pt). */
export const NEON_STROKE = 2;

export type NeonMode = 'off' | 'static' | 'run';

/** Seçili değilse kapalı. Azaltılmış harekette ya da ekran görünmüyorken nefes yok (sabit hale). */
export function neonMode({ selected, reduced, visible }: { selected: boolean; reduced: boolean; visible: boolean }): NeonMode {
  if (!selected) return 'off';
  if (reduced || !visible) return 'static';
  return 'run';
}

/** '#RRGGBB' + opaklık → 'rgba(r,g,b,a)'. */
export function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  const al = Math.max(0, Math.min(1, Math.round(a * 1000) / 1000));
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${al})`;
}

/**
 * Neon tüp gölgesi (CSS box-shadow sözdizimi): geniş yumuşak dış hale + sıkı parlak dış çekirdek + içe ince ışıma.
 * `glow` 0..1 (açık temada daha az).
 */
export function neonShadow(color: string, glow: number, inner: number): string {
  return [
    `0px 0px 22px 2px ${rgba(color, 0.55 * glow)}`,
    `0px 0px 8px 0px ${rgba(color, 0.9 * glow)}`,
    `inset 0px 0px 12px 0px ${rgba(color, inner)}`,
  ].join(', ');
}
