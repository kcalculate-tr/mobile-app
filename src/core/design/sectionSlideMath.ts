// G21-S1 md.9 — sayfa içi bölüm sekmeleri: saf hesap (RN yok, node testli).

/** Yeni içeriğin girdiği kayma oranı (FinMoTokens push: eski sayfa −%30). */
export const SECTION_SHIFT_RATIO = 0.3;

/**
 * Bölüm değişince yeni içeriğin başladığı yatay konum. Sağdaki sekmeye geçişte
 * içerik sağdan (+), soldakine geçişte soldan (−) gelir; aynı sekme → 0.
 */
export function sectionEnterOffset(prev: number, next: number, width: number): number {
  if (prev === next || !(width > 0)) return 0;
  return (next > prev ? 1 : -1) * width * SECTION_SHIFT_RATIO;
}

export interface IndicatorOpts {
  /** Gösterge sabit genişlikte (alt çizgi); verilmezse sütunu doldurur (hap). */
  itemWidth?: number;
  /** Kabın iç kenar boşluğu (her iki yan). */
  inset?: number;
  /** Sütunlar arası boşluk. */
  gap?: number;
}

/** Eşit sütunlu sekme satırında seçili göstergenin x konumu ve genişliği. */
export function indicatorFrame(
  index: number,
  count: number,
  containerWidth: number,
  { itemWidth, inset = 0, gap = 0 }: IndicatorOpts = {},
): { x: number; width: number } {
  if (!(containerWidth > 0) || count <= 0) return { x: 0, width: 0 };
  const i = Math.max(0, Math.min(count - 1, index));
  const segment = (containerWidth - inset * 2 - gap * (count - 1)) / count;
  const width = itemWidth != null ? Math.min(itemWidth, segment) : segment;
  const x = inset + i * (segment + gap) + (segment - width) / 2;
  return { x, width };
}
