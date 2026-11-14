// G49-S1 — YALNIZ __DEV__ vitrini: profilsiz Ana sayfa kartının açılış dizisini belirli bir anda DONDURUR
// (ekran görüntüsü "3 karelik açılış dizisi" için; simülatör çekimi zamanlamaya bağlı kalmasın). Üretimde etkisiz.
import { HOME_GATE_MOTION } from '../../../core/design/motion';

let frozenAt: number | null = null;

/** t: açılıştan sonraki ms (null = normal hareket). */
export function __devFreezeHomeGate(t: number | null): void {
  if (__DEV__) frozenAt = t;
}

export function devFrozenAt(): number | null {
  return __DEV__ ? frozenAt : null;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
type Curve = ((x: number) => number) | { factory: () => (x: number) => number };
/** Reanimated eğrisi JS'de: düz işlev ya da bezier fabrikası. */
const ease = (c: unknown, x: number): number => {
  const f = c as Curve;
  return typeof f === 'function' ? f(x) : f.factory()(x);
};

/** Dondurulmuş anda çizim ilerlemesi (halka / çubuk / sütun; `delay` = sütun kademesi). */
export function frozenDraw(t: number, delay = 0): number {
  return ease(HOME_GATE_MOTION.drawCurve, clamp01((t - delay) / HOME_GATE_MOTION.draw));
}

/** Dondurulmuş anda eylem kartı girişi (opaklık / kayma ilerlemesi). */
export function frozenEnter(t: number, index: number): number {
  return ease(HOME_GATE_MOTION.actCurve, clamp01((t - index * HOME_GATE_MOTION.actStagger) / HOME_GATE_MOTION.actEnter));
}
