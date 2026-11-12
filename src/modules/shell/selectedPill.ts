// G17-S2 md.5 — R3 tab bar seçili sekme göstergesi (Instagram gibi).
// Yarı saydam gri hap; ikon ve etiket normal mürekkep rengi (beyaz/ters ikon YOK).
// Geçiş: fast standard (PREMIUM.tab.duration + CURVE.standard).
export const SELECTED_PILL = {
  light: { bubble: 'rgba(10,10,10,0.08)', activeInk: '#0A0A0A' },
  dark: { bubble: 'rgba(255,255,255,0.14)', activeInk: '#F5F5F5' },
} as const;

// Seçili hap kayma süresi: G22-S2 md.1 — yerel sabit kaldırıldı; TabBarR3
// doğrudan `PREMIUM.tab.duration` (DURATION.fast, ×1,1 → 220) okur.
