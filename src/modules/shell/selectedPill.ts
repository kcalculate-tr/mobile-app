// G17-S2 md.5 — R3 tab bar seçili sekme göstergesi (Instagram gibi).
// Yarı saydam gri hap; ikon ve etiket normal mürekkep rengi (beyaz/ters ikon YOK).
// Geçiş: 200 standard (DURATION.fast + CURVE.standard).
export const SELECTED_PILL = {
  light: { bubble: 'rgba(10,10,10,0.08)', activeInk: '#0A0A0A' },
  dark: { bubble: 'rgba(255,255,255,0.14)', activeInk: '#F5F5F5' },
} as const;

/** Seçili hap kayma süresi (ms) — DURATION.fast ile aynı. */
export const SELECTED_PILL_MS = 200;
