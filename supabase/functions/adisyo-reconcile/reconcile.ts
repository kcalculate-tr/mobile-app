// supabase/functions/adisyo-reconcile/reconcile.ts
//
// D-S1 — gece mutabakatı çekirdeği (G/Ç bağımlılıkları dışarıdan verilir →
// birim testi: supabase/tests/adisyo_reconcile.test.ts).
//
//  (a) Kuyruk: adisyo_orders'a yazılamamış webhook olayları (ao_synced_at boş;
//      eski 2.576 uygulama dışı olay dahil) → GET /Order/{id} → upsert.
//      Aynı siparişin birden çok olayı tek GET ile kapanır.
//  (b) Son N saatte (varsayılan 48) kapanmamış/iptal olmamış siparişler yeniden çekilir.
//  (c) Tarih aralığı sipariş listesi uç noktası (DOĞRULANMADI) — app_settings
//      `adisyo_reconcile.list_endpoint_enabled` true ise dünün listesi çekilir,
//      adisyo_orders'ta olmayanlar eklenir. Varsayılan KAPALI.
//  Sonda adisyo_orders_relink(): geç gelen SaveOrder eşleşmeleri + şube anahtarı.
import { retryDelayMinutes, toAdisyoOrderRow, type AdisyoOrderRow } from "../_shared/adisyo-orders.ts";

export interface ReconcileConfig {
  batch: number;
  max_attempts: number;
  recheck_open_hours: number;
  delay_ms: number;
  time_budget_ms: number;
  list_endpoint_enabled: boolean;
  list_endpoint_path: string;
  list_query: string;
}

export const DEFAULT_CONFIG: ReconcileConfig = {
  batch: 150,
  max_attempts: 8,
  recheck_open_hours: 48,
  delay_ms: 150,
  time_budget_ms: 110_000,
  list_endpoint_enabled: false,
  list_endpoint_path: "Orders",
  list_query: "?startDate={from}&endDate={to}",
};

export interface QueueEvent {
  id: number;
  adisyo_order_id: number;
  order_id: number | null;
  ao_attempts: number;
}

export interface FetchResult { ok: boolean; body: unknown; error: string | null }

export interface ReconcileDeps {
  now(): Date;
  sleep(ms: number): Promise<void>;
  loadConfig(): Promise<Partial<ReconcileConfig> | null>;
  listQueue(limit: number, maxAttempts: number, nowIso: string): Promise<QueueEvent[]>;
  listOpenOrderIds(sinceIso: string, limit: number): Promise<number[]>;
  existingOrderIds(ids: number[]): Promise<Set<number>>;
  fetchOrder(adisyoOrderId: number): Promise<FetchResult>;
  fetchList(path: string): Promise<FetchResult>;
  upsert(row: AdisyoOrderRow): Promise<{ error: string | null }>;
  markSynced(events: QueueEvent[], nowIso: string): Promise<void>;
  markFailed(events: QueueEvent[], error: string, nextRetryIso: (attempts: number) => string): Promise<void>;
  relink(): Promise<number>;
}

export interface ReconcileSummary {
  queue: { events: number; orders: number; ok: number; failed: number };
  open: { orders: number; ok: number; failed: number };
  list: { enabled: boolean; listed: number; missing: number; added: number; error: string | null; path: string | null };
  relinked: number;
  stopped_by_budget: boolean;
  errors: string[];
}

export function mergeConfig(raw: Partial<ReconcileConfig> | null | undefined): ReconcileConfig {
  const c = { ...DEFAULT_CONFIG, ...(raw ?? {}) };
  const num = (v: unknown, d: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : d;
  };
  return {
    batch: num(c.batch, DEFAULT_CONFIG.batch, 1, 1000),
    max_attempts: num(c.max_attempts, DEFAULT_CONFIG.max_attempts, 1, 50),
    recheck_open_hours: num(c.recheck_open_hours, DEFAULT_CONFIG.recheck_open_hours, 1, 24 * 14),
    delay_ms: num(c.delay_ms, DEFAULT_CONFIG.delay_ms, 0, 5000),
    time_budget_ms: num(c.time_budget_ms, DEFAULT_CONFIG.time_budget_ms, 5_000, 380_000),
    list_endpoint_enabled: c.list_endpoint_enabled === true,
    list_endpoint_path: String(c.list_endpoint_path || DEFAULT_CONFIG.list_endpoint_path).replace(/^\/+/, ""),
    list_query: String(c.list_query ?? DEFAULT_CONFIG.list_query),
  };
}

/** İstanbul takvimine göre dünün tarihi (YYYY-MM-DD). Türkiye UTC+3, yaz saati yok. */
export function istanbulYesterday(now: Date): string {
  const ist = new Date(now.getTime() + 3 * 3600_000);
  ist.setUTCDate(ist.getUTCDate() - 1);
  return ist.toISOString().slice(0, 10);
}

/** Liste yanıtından sipariş dizisini bulur: data[], data.orders[], data.items[], kök dizi. */
export function extractList(body: unknown): Record<string, unknown>[] {
  const b = body as Record<string, unknown> | null;
  const cands: unknown[] = [
    b?.data,
    (b?.data as Record<string, unknown> | undefined)?.orders,
    (b?.data as Record<string, unknown> | undefined)?.items,
    (b?.data as Record<string, unknown> | undefined)?.list,
    b?.orders,
    body,
  ];
  for (const c of cands) if (Array.isArray(c)) return c.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
  return [];
}

function idOf(item: Record<string, unknown>): number | null {
  const v = item.id ?? item.Id ?? item.orderId ?? item.OrderId;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

/** Liste öğesi tam sipariş gibi mi (tekrar GET gerekmez)? */
function looksFullOrder(item: Record<string, unknown>): boolean {
  return Array.isArray(item.products) && (item.orderTotal !== undefined || item.OrderTotal !== undefined);
}

export async function runReconcile(deps: ReconcileDeps): Promise<ReconcileSummary> {
  const cfg = mergeConfig(await deps.loadConfig());
  const started = deps.now().getTime();
  const overBudget = () => deps.now().getTime() - started > cfg.time_budget_ms;
  const s: ReconcileSummary = {
    queue: { events: 0, orders: 0, ok: 0, failed: 0 },
    open: { orders: 0, ok: 0, failed: 0 },
    list: { enabled: cfg.list_endpoint_enabled, listed: 0, missing: 0, added: 0, error: null, path: null },
    relinked: 0,
    stopped_by_budget: false,
    errors: [],
  };
  const done = new Set<number>();
  let first = true;
  const pace = async () => { if (!first && cfg.delay_ms) await deps.sleep(cfg.delay_ms); first = false; };

  async function syncOne(id: number, preset?: unknown): Promise<string | null> {
    let body = preset;
    if (body === undefined) {
      await pace();
      const r = await deps.fetchOrder(id);
      if (!r.ok) return `get_order_failed: ${r.error}`;
      body = r.body;
    }
    const row = await toAdisyoOrderRow(body, id);
    if (!row) return "order_body_unreadable";
    const u = await deps.upsert(row);
    return u.error ? `upsert_failed: ${u.error}` : null;
  }

  // (a) kuyruk
  const nowIso = deps.now().toISOString();
  const events = await deps.listQueue(cfg.batch * 4, cfg.max_attempts, nowIso);
  s.queue.events = events.length;
  const byOrder = new Map<number, QueueEvent[]>();
  for (const e of events) {
    const list = byOrder.get(e.adisyo_order_id) ?? [];
    list.push(e);
    byOrder.set(e.adisyo_order_id, list);
  }
  for (const [id, evs] of [...byOrder.entries()].slice(0, cfg.batch)) {
    if (overBudget()) { s.stopped_by_budget = true; break; }
    s.queue.orders++;
    const err = await syncOne(id);
    if (err) {
      s.queue.failed++;
      await deps.markFailed(evs, err, (a) => new Date(deps.now().getTime() + retryDelayMinutes(a) * 60_000).toISOString());
      if (s.errors.length < 10) s.errors.push(`${id}: ${err}`);
    } else {
      s.queue.ok++;
      done.add(id);
      await deps.markSynced(evs, deps.now().toISOString());
    }
  }

  // (b) açık siparişler
  if (!s.stopped_by_budget) {
    const since = new Date(deps.now().getTime() - cfg.recheck_open_hours * 3600_000).toISOString();
    const open = (await deps.listOpenOrderIds(since, cfg.batch)).filter((id) => !done.has(id));
    for (const id of open) {
      if (overBudget()) { s.stopped_by_budget = true; break; }
      s.open.orders++;
      const err = await syncOne(id);
      if (err) { s.open.failed++; if (s.errors.length < 10) s.errors.push(`${id}: ${err}`); }
      else { s.open.ok++; done.add(id); }
    }
  }

  // (c) liste uç noktası (varsayılan KAPALI)
  if (cfg.list_endpoint_enabled && !s.stopped_by_budget) {
    const day = istanbulYesterday(deps.now());
    const path = cfg.list_endpoint_path + cfg.list_query.replaceAll("{from}", day).replaceAll("{to}", day);
    s.list.path = path;
    await pace();
    const r = await deps.fetchList(path);
    if (!r.ok) {
      s.list.error = r.error;
    } else {
      const items = extractList(r.body);
      s.list.listed = items.length;
      const ids = items.map(idOf).filter((x): x is number => x !== null);
      const have = await deps.existingOrderIds(ids);
      const missing = items.filter((it) => { const id = idOf(it); return id !== null && !have.has(id) && !done.has(id); });
      s.list.missing = missing.length;
      for (const it of missing.slice(0, cfg.batch)) {
        if (overBudget()) { s.stopped_by_budget = true; break; }
        const id = idOf(it)!;
        const err = await syncOne(id, looksFullOrder(it) ? it : undefined);
        if (err) { if (s.errors.length < 10) s.errors.push(`${id}: ${err}`); }
        else { s.list.added++; done.add(id); }
      }
    }
  }

  try { s.relinked = await deps.relink(); }
  catch (e) { s.errors.push(`relink: ${String(e).slice(0, 200)}`); }
  return s;
}
