// G18-S2 md.2 — FinMoPopover yerleşimi (SAF). Çapa: "…'e logla ⌄" hapı (pencere
// koordinatı). Sol kenar hapla hizalı, 4 pt boşluk; altta (tab bar 100 dahil) yer
// yoksa yukarı; sağa taşarsa sola kayar (16 pt pay). Köken: chevron merkezi
// (hapın sağından 22 pt).
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const POP_W = 240;
// 6 + 24 + 4×44 + (1 + 2×6) + 24 + 44 + 6 = 293 (pano "240 × 293").
export const POP_H = 293;
export const POP_GAP = 4;
export const EDGE = 16;
export const TAB_BAR_H = 100;

export const PORTIONS = [
  { key: 'half', label: '½', value: 0.5 },
  { key: 'one', label: '1', value: 1 },
  { key: 'one_half', label: '1½', value: 1.5 },
  { key: 'two', label: '2', value: 2 },
] as const;

export function placePopover(
  anchor: Rect,
  win: { width: number; height: number },
): { left: number; top: number; up: boolean; originX: number } {
  const up = anchor.y + anchor.height + POP_GAP + POP_H > win.height - TAB_BAR_H;
  const maxLeft = win.width - EDGE - POP_W;
  const left = Math.max(EDGE, Math.min(anchor.x, maxLeft));
  // Ekran içinde kalır (üst 48 = durum çubuğu payı, alt = tab bar).
  const raw = up ? anchor.y - POP_GAP - POP_H : anchor.y + anchor.height + POP_GAP;
  const top = Math.max(48, Math.min(raw, win.height - TAB_BAR_H - POP_H));
  const chevronX = anchor.x + anchor.width - 22;
  const originX = Math.max(0, Math.min(POP_W, chevronX - left));
  return { left, top, up, originX };
}
