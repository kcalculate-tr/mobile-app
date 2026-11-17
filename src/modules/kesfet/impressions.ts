// G60-S1 md.3 — Keşfet görüntülenme ölçümü (SAF mantık + ince uygulama bağlantısı).
//
// Kural: kart ekranda ≥ 1 sn göründüğünde bir görüntülenme; OTURUM başına aynı gönderi bir kez;
// toplu gönderim (10'luk paket ya da ilk öğeden 30 sn sonra). Hedef: `record_post_views` RPC
// (ayrı hafif tablo `post_views`; analytics_events şişmez). Yalnız `kesfet_siralama` açıkken
// çağrılır (çağıran denetler). Bu turda puana GİRMEZ.
//
// Güvenlik ağı: ölçüm akışı ASLA bozmaz — gönderim hatası yutulur; RPC yoksa ('missing') ya da
// sunucuda bayrak kapalıysa ('off') bu oturum için toplama durur.
import type { PostViewItem } from './types';

export const IMPRESSION_MIN_VISIBLE_MS = 1000;
export const IMPRESSION_BATCH = 10;
export const IMPRESSION_FLUSH_MS = 30_000;
/** Tek görüntülenmede sayılan en uzun süre (sunucu da 600 sn ile sınırlar). */
export const IMPRESSION_MAX_DWELL_MS = 600_000;

export type SendResult = 'ok' | 'off' | 'missing';

export interface ImpressionTrackerOptions {
  now: () => number;
  send: (items: PostViewItem[]) => Promise<SendResult>;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  minVisibleMs?: number;
  batchSize?: number;
  flushMs?: number;
}

export interface ImpressionTracker {
  /** Şu an ekranda (eşik üstü görünür) olan gönderi kimlikleri. */
  update(visibleIds: readonly string[]): void;
  /** Ekran odağı gitti / uygulama arka planda: görünenleri kapat (≥ 1 sn olanlar kuyruğa). */
  pause(): void;
  /** Kuyruğu hemen gönder. */
  flush(): Promise<void>;
  /** Test/teşhis. */
  readonly stats: { queued: number; sent: number; stopped: boolean; visible: number };
}

export function createImpressionTracker(opts: ImpressionTrackerOptions): ImpressionTracker {
  const minMs = opts.minVisibleMs ?? IMPRESSION_MIN_VISIBLE_MS;
  const batch = opts.batchSize ?? IMPRESSION_BATCH;
  const flushMs = opts.flushMs ?? IMPRESSION_FLUSH_MS;
  const setTimer = opts.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));

  const visibleSince = new Map<string, number>();
  const counted = new Set<string>(); // oturumda bir kez
  let queue: PostViewItem[] = [];
  let timer: unknown = null;
  let stopped = false;
  let sending: Promise<void> | null = null;

  function schedule() {
    if (timer != null || queue.length === 0) return;
    timer = setTimer(() => {
      timer = null;
      void flush();
    }, flushMs);
  }

  function close(id: string, t: number) {
    const start = visibleSince.get(id);
    visibleSince.delete(id);
    if (start == null || stopped || counted.has(id)) return;
    const dwell = t - start;
    if (dwell < minMs) return;
    counted.add(id);
    queue.push({ post_id: id, dwell_ms: Math.min(Math.round(dwell), IMPRESSION_MAX_DWELL_MS) });
    if (queue.length >= batch) void flush();
    else schedule();
  }

  async function flush(): Promise<void> {
    if (timer != null) {
      clearTimer(timer);
      timer = null;
    }
    if (sending) await sending;
    if (stopped || queue.length === 0) {
      queue = stopped ? [] : queue;
      return;
    }
    const items = queue.slice(0, 50);
    queue = queue.slice(items.length);
    sending = (async () => {
      let res: SendResult = 'ok';
      try {
        res = await opts.send(items);
      } catch {
        res = 'ok'; // ağ hatası: bu paket düşer, ölçüm devam eder (akış bozulmaz)
      }
      if (res !== 'ok') {
        stopped = true;
        queue = [];
        visibleSince.clear();
      }
    })();
    await sending;
    sending = null;
    if (queue.length > 0) schedule();
  }

  return {
    update(visibleIds) {
      if (stopped) return;
      const t = opts.now();
      const next = new Set(visibleIds);
      for (const id of Array.from(visibleSince.keys())) if (!next.has(id)) close(id, t);
      for (const id of next) if (!visibleSince.has(id) && !counted.has(id)) visibleSince.set(id, t);
    },
    pause() {
      const t = opts.now();
      for (const id of Array.from(visibleSince.keys())) close(id, t);
    },
    flush,
    get stats() {
      return { queued: queue.length, sent: counted.size - queue.length, stopped, visible: visibleSince.size };
    },
  };
}

// ── Uygulama bağlantısı: oturum (süreç) boyunca tek izleyici ───────────────────
let shared: ImpressionTracker | null = null;

/** Gerçek istemciyle (record_post_views) oturum izleyicisi. Tembel kurulur. */
export function sessionImpressions(send: (items: PostViewItem[]) => Promise<SendResult>): ImpressionTracker {
  if (!shared) shared = createImpressionTracker({ now: () => Date.now(), send });
  return shared;
}

/** Test: oturum izleyicisini sıfırla. */
export function __resetSessionImpressions(): void {
  shared = null;
}
