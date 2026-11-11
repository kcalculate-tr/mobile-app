// G28-S1 md.1 — "Logla izi" ORTAK giriş (FinMoLogA). Tara sonucu, Keşfet, tarif (gönderi
// detayı) ve Koç kartı "Günüme ekle" kayıt yazıldıktan sonra YALNIZ bunu çağırır:
//   logTrace({ from: <tabak görünümü>, imageUri, mealLabel, id, undo, ... })
// Kaynak görünüm ölçülür (measureInWindow) → `kcal:logFlight`; kökteki LogTraceHost tabağı
// Ana sayfa sekmesine uçurur, varışta "+1" rozeti (TabBarR3) + success haptik + toast
// ("<Öğün>'ye loglandı · Geri al · Gör"). Ölçülemezse uçuşsuz rozet + toast.
//
// Ayrıca: Ana sayfa sekmesi hedef noktası (TabBarR3 yazar, LogTraceHost okur) ve rozet olayı.
import { DeviceEventEmitter, type EmitterSubscription } from 'react-native';
import { emitLogFlight, type LogFlightPayload } from './logEvents';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Measurable = { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void };

/** Görünümün ekran konumu; ölçülemezse / süre aşımında null (uçuşsuz yol). */
export function measureRect(node: Measurable | null | undefined, timeoutMs = 120): Promise<Rect | null> {
  return new Promise((resolve) => {
    if (!node || typeof node.measureInWindow !== 'function') {
      resolve(null);
      return;
    }
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(null);
      }
    }, timeoutMs);
    try {
      node.measureInWindow((x, y, w, h) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(w > 0 && h > 0 ? { x, y, w, h } : null);
      });
    } catch {
      done = true;
      clearTimeout(timer);
      resolve(null);
    }
  });
}

export type LogTraceOptions = Omit<LogFlightPayload, 'x' | 'y' | 'w' | 'h'> & {
  /** Uçuşun başladığı görünüm (tabak / kart görseli / düğme). */
  from?: Measurable | null;
  /** Önceden ölçülmüş konum (`from` yerine). */
  rect?: Rect | null;
};

/** Kayıt yazıldı → logla izi. Her log ayrı uçuş ve +1 (art arda dahil). */
export async function logTrace(opts: LogTraceOptions): Promise<void> {
  const { from, rect: given, ...payload } = opts;
  const rect = given ?? (from ? await measureRect(from) : null);
  emitLogFlight({
    ...payload,
    x: rect?.x ?? 0,
    y: rect?.y ?? 0,
    w: rect?.w ?? 0,
    h: rect?.h ?? 0,
  });
}

// ── Ana sayfa sekmesi hedefi (ekran koordinatı, ikon merkezi) ─────────────────
let homeTarget: { x: number; y: number } | null = null;
export function setHomeTabTarget(p: { x: number; y: number } | null): void {
  homeTarget = p;
}
export function getHomeTabTarget(): { x: number; y: number } | null {
  return homeTarget;
}

// ── Rozet olayı (LogTraceHost → TabBarR3) ────────────────────────────────────
export const LOG_BADGE_EVENT = 'kcal:logBadge';
export interface LogBadgePayload {
  /** +1 varış · −1 Geri al · 'clear' Ana sayfa görüldü. */
  delta: 1 | -1 | 'clear';
}
export function emitLogBadge(delta: LogBadgePayload['delta']): void {
  DeviceEventEmitter.emit(LOG_BADGE_EVENT, { delta } as LogBadgePayload);
}
export function onLogBadge(handler: (p: LogBadgePayload) => void): EmitterSubscription {
  return DeviceEventEmitter.addListener(LOG_BADGE_EVENT, handler);
}

/** Rozet metni: en fazla "9+" (FinMoLogA). */
export function badgeText(n: number): string {
  return n > 9 ? '9+' : `+${n}`;
}
