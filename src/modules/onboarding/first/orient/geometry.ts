// G18-S1 md.6 — FinOrient1–4 yerleşimi SAF (node:test). Panolardan:
//  · balon 236 pt; hedefin ekran yarısına göre üstte/altta, hedefle arası 12 pt
//  · hedef sağ yarıdaysa balon sağdan 12, değilse soldan 16
//  · ok (14 pt, 45°) hedefin işaret noktasına bakar; balon kenarından ≥ 14 pt
//  · delik: hedef + 6 pt pay (ekran kenarından ≥ 4 pt); Tara daire, logla/Keşfet
//    hap, Gün halkası 24 köşe
import type { OrientTargetId } from '../state';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Hole extends Rect {
  r: number;
}

export const TIP_W = 236;
export const TIP_GAP = 12;
export const HOLE_PAD = 6;
export const ARROW = 14;
const EDGE = 4;

const SHAPE: Record<OrientTargetId, 'circle' | 'pill' | 'rect'> = {
  scan: 'circle',
  log: 'pill',
  ring: 'rect',
  kesfet: 'pill',
};
/** Okun deliğin hangi yatay noktasını gösterdiği (0..1). Logla: ana düğme (oktan önce); Keşfet: "Sana Özel". */
const ARROW_FRAC: Record<OrientTargetId, number> = { scan: 0.5, log: 0.43, ring: 0.5, kesfet: 0.25 };

export function holeFor(id: OrientTargetId, r: Rect, screenW: number): Hole {
  let x = r.x - HOLE_PAD;
  let w = r.w + HOLE_PAD * 2;
  const y = r.y - HOLE_PAD;
  const h = r.h + HOLE_PAD * 2;
  if (x < EDGE) {
    w -= EDGE - x;
    x = EDGE;
  }
  if (x + w > screenW - EDGE) w = screenW - EDGE - x;
  const shape = SHAPE[id];
  if (shape === 'circle') {
    const d = Math.max(w, h);
    const cx = x + w / 2;
    const cy = y + h / 2;
    return { x: cx - d / 2, y: cy - d / 2, w: d, h: d, r: d / 2 };
  }
  return { x, y, w, h, r: shape === 'pill' ? h / 2 : 24 };
}

export interface TipPlacement {
  left: number;
  /** Balon üstteyse (hedef alt yarıda): ekranın altından uzaklık. */
  bottom?: number;
  /** Balon alttaysa: ekranın üstünden uzaklık. */
  top?: number;
  above: boolean;
  /** Okun balon içindeki sol kenarı. */
  arrowLeft: number;
}

export function placeTip(id: OrientTargetId, hole: Hole, screen: { w: number; h: number }): TipPlacement {
  const pointX = hole.x + hole.w * ARROW_FRAC[id];
  const right = pointX > screen.w / 2;
  const left = right ? screen.w - 12 - TIP_W : 16;
  const arrowLeft = Math.min(TIP_W - ARROW - 14, Math.max(14, pointX - left - ARROW / 2));
  const above = hole.y + hole.h / 2 > screen.h / 2;
  return above
    ? { left, bottom: screen.h - (hole.y - TIP_GAP), above, arrowLeft }
    : { left, top: hole.y + hole.h + TIP_GAP, above, arrowLeft };
}

/** Delikli örtü yolu (evenodd): ekran dikdörtgeni + yuvarlatılmış delik. */
export function scrimPath(screen: { w: number; h: number }, o: Hole): string {
  const r = Math.min(o.r, o.w / 2, o.h / 2);
  const { x, y, w, h } = o;
  return (
    `M0 0H${screen.w}V${screen.h}H0Z ` +
    `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}` +
    `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}` +
    `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
  );
}
