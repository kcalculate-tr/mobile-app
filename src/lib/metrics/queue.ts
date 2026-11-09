// G19-S3 — Olay kuyruğu (saf çekirdek; depolama, gönderici, saat ve zamanlayıcı
// enjekte edilir → native bağımlılık yok, node:test ile test edilir).
//
// Davranış
//  • enqueue(): satır önce bellekteki kuyruğa, sonra kalıcı depoya yazılır
//    (uygulama kapanırsa kaybolmaz). Kuyruk ≥ BATCH_SIZE ise hemen, değilse
//    FLUSH_DELAY_MS sonra toplu gönderim.
//  • flush(): aynı anda tek gönderim; en çok BATCH_SIZE satır tek insert.
//    Başarılı → satırlar düşer, kalan varsa devam.
//    Ağ/5xx (yeniden denenebilir) → üstel bekleme (5 s · 2^n, en çok 5 dk).
//    Kalıcı ret (4xx: RLS, şema) → satırların `attempts` sayacı artar;
//    MAX_ATTEMPTS'e ulaşan satır atılır (zehirli toplu iş kuyruğu kilitlemez).
//  • Gönderimden önce: satırın user_id'si o anki oturumla uyuşmuyorsa
//    (çıkış/hesap değişimi) user_id NULL'a çekilir, props._user_mismatch=true
//    — canlı RLS (user_id is null or = auth.uid()) toplu insert'i reddetmesin.
//    anon_id korunur; sunucu anon_id ile birleştirir.
//  • Kuyruk sınırı MAX_QUEUE; taşarsa EN ESKİ satırlar atılır.
//  • Eski sürümün kuyruğu (aynı anahtar, `attempts` alanı yok) okunur.

export type AnalyticsRow = {
  event_name: string;
  props: Record<string, unknown>;
  user_id: string | null;
  anon_id: string;
  session_id: string;
  platform: string;
  app_version: string;
  created_at: string;
};

type QueuedRow = AnalyticsRow & { attempts?: number };

export type SendResult = { ok: true } | { ok: false; retryable: boolean; message?: string };

export interface QueueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface QueueDeps {
  storage: QueueStorage;
  send(rows: AnalyticsRow[]): Promise<SendResult>;
  currentUserId(): Promise<string | null>;
  now?(): number;
  schedule?(fn: () => void, ms: number): unknown;
  cancel?(handle: unknown): void;
}

export const QUEUE_KEY = '@kcal_analytics_queue';
export const MAX_QUEUE = 500;
export const BATCH_SIZE = 50;
export const FLUSH_DELAY_MS = 3000;
export const MAX_ATTEMPTS = 5;
export const BASE_BACKOFF_MS = 5000;
export const MAX_BACKOFF_MS = 5 * 60 * 1000;

/** Postgrest hatası yeniden denenebilir mi? (ağ, zaman aşımı, 5xx, 429) */
export function isRetryableError(err: { code?: string; status?: number; message?: string } | null | undefined): boolean {
  if (!err) return true;
  const status = typeof err.status === 'number' ? err.status : 0;
  if (status === 429 || status >= 500) return true;
  if (status >= 400 && status < 500) return false;
  const code = String(err.code ?? '');
  // Postgres SQLSTATE: 42501 RLS, 23xxx kısıt, 22xxx veri, PGRST2xx şema → kalıcı.
  if (/^(42|23|22)\d{3}$/.test(code) || /^PGRST(1|2)\d\d$/.test(code)) return false;
  return true; // bilinmeyen (çoğunlukla ağ: "Network request failed") → yeniden dene
}

export function backoffMs(failures: number): number {
  if (failures <= 0) return 0;
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (failures - 1));
}

export class EventQueue {
  private rows: QueuedRow[] = [];
  private loaded: Promise<void> | null = null;
  private flushing: Promise<void> | null = null;
  private timer: unknown = null;
  private failures = 0;
  private nextAllowedAt = 0;
  private persistChain: Promise<void> = Promise.resolve();

  constructor(private readonly deps: QueueDeps) {}

  private now(): number {
    return this.deps.now ? this.deps.now() : Date.now();
  }

  load(): Promise<void> {
    if (!this.loaded) {
      this.loaded = (async () => {
        try {
          const raw = await this.deps.storage.getItem(QUEUE_KEY);
          const parsed = raw ? (JSON.parse(raw) as unknown) : [];
          const stored = Array.isArray(parsed) ? (parsed as QueuedRow[]).filter((r) => r && typeof r.event_name === 'string') : [];
          // Yükleme sırasında eklenenler sona gelir.
          this.rows = [...stored, ...this.rows].slice(-MAX_QUEUE);
        } catch {
          /* bozuk kuyruk: yok say, yeniden başla */
        }
      })();
    }
    return this.loaded;
  }

  size(): number {
    return this.rows.length;
  }

  snapshot(): AnalyticsRow[] {
    return this.rows.map(({ attempts: _a, ...r }) => r);
  }

  private persist(): Promise<void> {
    const data = JSON.stringify(this.rows);
    this.persistChain = this.persistChain
      .then(() => this.deps.storage.setItem(QUEUE_KEY, data))
      .catch(() => {
        /* depo yazılamadı: bellekte kalır, bir sonraki persist dener */
      });
    return this.persistChain;
  }

  async enqueue(row: AnalyticsRow): Promise<void> {
    await this.load();
    this.rows.push(row);
    if (this.rows.length > MAX_QUEUE) this.rows.splice(0, this.rows.length - MAX_QUEUE);
    await this.persist();
    if (this.rows.length >= BATCH_SIZE) void this.flush();
    else this.scheduleFlush(FLUSH_DELAY_MS);
  }

  private scheduleFlush(ms: number): void {
    if (!this.deps.schedule) return;
    if (this.timer !== null) return;
    this.timer = this.deps.schedule(() => {
      this.timer = null;
      void this.flush();
    }, ms);
  }

  private clearTimer(): void {
    if (this.timer !== null && this.deps.cancel) this.deps.cancel(this.timer);
    this.timer = null;
  }

  /** Ağ geri geldi / uygulama arka plana gitti: beklemeyi sıfırlayıp hemen dene. */
  async flushNow(): Promise<void> {
    this.nextAllowedAt = 0;
    this.clearTimer();
    return this.flush();
  }

  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = this.doFlush().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async doFlush(): Promise<void> {
    await this.load();
    const t = this.now();
    if (t < this.nextAllowedAt) {
      this.scheduleFlush(this.nextAllowedAt - t);
      return;
    }
    while (this.rows.length > 0) {
      const batch = this.rows.slice(0, BATCH_SIZE);
      const uid = await this.safeUid();
      const payload: AnalyticsRow[] = batch.map(({ attempts: _a, ...r }) =>
        r.user_id && r.user_id !== uid
          ? { ...r, user_id: null, props: { ...r.props, _user_mismatch: true } }
          : r,
      );
      let res: SendResult;
      try {
        res = await this.deps.send(payload);
      } catch (e) {
        res = { ok: false, retryable: true, message: e instanceof Error ? e.message : String(e) };
      }
      if (res.ok) {
        this.failures = 0;
        this.rows.splice(0, batch.length);
        await this.persist();
        continue;
      }
      if (res.retryable) {
        this.failures += 1;
        const wait = backoffMs(this.failures);
        this.nextAllowedAt = this.now() + wait;
        this.scheduleFlush(wait);
        return;
      }
      // Kalıcı ret: sayaç artır, sınırı aşanları at; bir sonraki denemeye bırak.
      for (const r of batch) r.attempts = (r.attempts ?? 0) + 1;
      this.rows = this.rows.filter((r) => (r.attempts ?? 0) < MAX_ATTEMPTS);
      await this.persist();
      this.failures += 1;
      const wait = backoffMs(this.failures);
      this.nextAllowedAt = this.now() + wait;
      if (this.rows.length > 0) this.scheduleFlush(wait);
      return; // aynı toplu işi hemen tekrar deneme
    }
  }

  private async safeUid(): Promise<string | null> {
    try {
      return await this.deps.currentUserId();
    } catch {
      return null;
    }
  }
}

// ── Oturum kimliği ───────────────────────────────────────────────────────
// Oturum = uygulama ön planda iken etkinlik dizisi. 30 dk'dan uzun sessizlik
// (arka planda kalma dahil) yeni oturum başlatır.
export const SESSION_IDLE_MS = 30 * 60 * 1000;

export const genId = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export class SessionClock {
  private id: string;
  private last: number;
  constructor(
    private readonly now: () => number = Date.now,
    private readonly gen: () => string = genId,
  ) {
    this.id = gen();
    this.last = now();
  }
  /** Etkinlik anında çağrılır; gerekiyorsa yeni oturum açar. */
  touch(): { id: string; isNew: boolean } {
    const t = this.now();
    let isNew = false;
    if (t - this.last > SESSION_IDLE_MS) {
      this.id = this.gen();
      isNew = true;
    }
    this.last = t;
    return { id: this.id, isNew };
  }
  current(): string {
    return this.id;
  }
}
