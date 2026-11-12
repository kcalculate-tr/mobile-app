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

/** Uçan kopya bu sürede ekrana gelmezse kaynak ekran yine kapanır (görsel çözülemedi vb.). */
export const FLIGHT_START_TIMEOUT_MS = 400;

/**
 * Kayıt yazıldı → logla izi. Her log ayrı uçuş ve +1 (art arda dahil).
 * G30-S1 md.1: söz, uçan kopya ekranda GÖRÜNÜNCE (ya da uçuş yoksa hemen; en geç
 * FLIGHT_START_TIMEOUT_MS) çözülür — kaynak ekran ancak o zaman kapanmalı. Önceden kayıt
 * yayınlanır yayınlanmaz ekran kapanıyor, kopya 1–3 kare sonra (görsel çözülünce) beliriyordu:
 * görsel bir an kaybolup başka yerde yeniden çıkıyordu.
 */
export async function logTrace(opts: LogTraceOptions): Promise<void> {
  const { from, rect: given, ...payload } = opts;
  const rect = given ?? (from ? await measureRect(from) : null);
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, FLIGHT_START_TIMEOUT_MS);
    const userStart = payload.onStart;
    emitLogFlight({
      ...payload,
      x: rect?.x ?? 0,
      y: rect?.y ?? 0,
      w: rect?.w ?? 0,
      h: rect?.h ?? 0,
      onStart: () => {
        try {
          userStart?.();
        } finally {
          finish();
        }
      },
    });
  });
}

/**
 * G30-S1 md.1: lifted (kalkmış) çıkartmanın GÖRÜNEN kutusu. StickerLift dönüşümü
 * (translateY LIFT_SHIFT, ölçek LIFT_SCALE, merkez etrafında) Reanimated'da UI thread'de
 * uygulanır ve ölçüme yansımaz → ölçülen dönüşümsüz kutuya burada eklenir.
 */
export function liftedRect(r: Rect, shiftY: number, scale: number): Rect {
  const w = r.w * scale;
  const h = r.h * scale;
  return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2 + shiftY, w, h };
}

// ── Ana sayfa sekmesi hedefi (ekran koordinatı, ikon merkezi) ─────────────────
// G30-S1 md.1: TabBarR3 hem hesaplanan noktayı hem ikon GÖRÜNÜMÜNÜ bildirir; uçuş başlarken
// ikon ölçülür (gerçek konum — bar küçülmüş/yükselirken de doğru), ölçülemezse hesaplanan.
let homeTarget: { x: number; y: number } | null = null;
let homeNode: Measurable | null = null;
export function setHomeTabTarget(p: { x: number; y: number } | null): void {
  homeTarget = p;
}
export function getHomeTabTarget(): { x: number; y: number } | null {
  return homeTarget;
}
export function setHomeTabNode(node: Measurable | null): void {
  homeNode = node;
}
/** Ana sayfa sekme ikonunun ölçülmüş merkezi; olmazsa hesaplanan nokta; o da yoksa null. */
export async function measureHomeTabTarget(): Promise<{ x: number; y: number } | null> {
  const r = homeNode ? await measureRect(homeNode, 80) : null;
  if (r) return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  return homeTarget;
}

// ── Ana sayfa görünür mü? (kök rota Tabs ve etkin sekme Tracker) ─────────────
type NavStateLike = { index?: number; routes?: { name?: string; state?: NavStateLike }[] } | undefined | null;
/** Kök gezinme durumundan: Ana sayfa (Tracker) sekmesi şu an ekranda mı. */
export function isHomeVisible(root: NavStateLike): boolean {
  const top = root?.routes?.[root.index ?? 0];
  if (!top || top.name !== 'Tabs') return false;
  const tabs = top.state;
  // Sekme durumu henüz yoksa bilinmiyor → görünmüyor say (rozet yolu, FinMoLogA varsayılanı).
  if (!tabs?.routes?.length) return false;
  return tabs.routes[tabs.index ?? 0]?.name === 'Tracker';
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
