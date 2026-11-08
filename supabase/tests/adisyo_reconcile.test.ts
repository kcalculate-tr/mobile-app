// D-S1 — adisyo-reconcile çekirdek testleri (sahte bağımlılıklar; ağ/DB yok).
// Çalıştırma: deno test --no-config supabase/tests/adisyo_reconcile.test.ts
import {
  extractList,
  istanbulYesterday,
  mergeConfig,
  runReconcile,
  type QueueEvent,
  type ReconcileDeps,
} from "../functions/adisyo-reconcile/reconcile.ts";
import type { AdisyoOrderRow } from "../functions/_shared/adisyo-orders.ts";

function eq(a: unknown, b: unknown, msg = "") {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error(`${msg}\n  beklenen: ${y}\n  gelen:    ${x}`);
}

const order = (id: number, extra: Record<string, unknown> = {}) => ({
  status: 100, data: {
    id, statusId: 1, orderTotal: 100, insertDate: "2026-11-08T12:00:00", externalAppName: "Trendyol Go",
    customer: { name: "Gizli Kişi", phone: "05550000000" }, products: [{ productName: "Bowl", quantity: 1, unitPrice: 100 }], ...extra,
  },
});

function makeDeps(opts: {
  queue?: QueueEvent[];
  open?: number[];
  failIds?: number[];
  config?: Record<string, unknown> | null;
  list?: unknown;
  listFail?: boolean;
  existing?: number[];
  clockStepMs?: number;
}) {
  const log = {
    fetched: [] as number[], upserted: [] as AdisyoOrderRow[], synced: [] as number[][],
    failed: [] as Array<{ ids: number[]; error: string; next: string[] }>, listPaths: [] as string[], sleeps: 0,
  };
  let t = Date.parse("2026-11-09T01:00:00Z");
  const deps: ReconcileDeps = {
    now: () => { t += opts.clockStepMs ?? 0; return new Date(t); },
    sleep: () => { log.sleeps++; return Promise.resolve(); },
    loadConfig: () => Promise.resolve((opts.config ?? null) as never),
    listQueue: (limit) => Promise.resolve((opts.queue ?? []).slice(0, limit)),
    listOpenOrderIds: () => Promise.resolve(opts.open ?? []),
    existingOrderIds: (ids) => Promise.resolve(new Set(ids.filter((i) => (opts.existing ?? []).includes(i)))),
    fetchOrder: (id) => {
      log.fetched.push(id);
      return Promise.resolve(opts.failIds?.includes(id)
        ? { ok: false, body: null, error: "http_500" }
        : { ok: true, body: order(id), error: null });
    },
    fetchList: (path) => {
      log.listPaths.push(path);
      return Promise.resolve(opts.listFail ? { ok: false, body: null, error: "http_404" } : { ok: true, body: opts.list, error: null });
    },
    upsert: (row) => { log.upserted.push(row); return Promise.resolve({ error: null }); },
    markSynced: (evs) => { log.synced.push(evs.map((e) => e.id)); return Promise.resolve(); },
    markFailed: (evs, error, next) => {
      log.failed.push({ ids: evs.map((e) => e.id), error, next: evs.map((e) => next(e.ao_attempts)) });
      return Promise.resolve();
    },
    relink: () => Promise.resolve(3),
  };
  return { deps, log };
}

const ev = (id: number, oid: number, order_id: number | null = null, ao_attempts = 0): QueueEvent => ({ id, adisyo_order_id: oid, order_id, ao_attempts });

Deno.test("kuyruk: sipariş başına tek GET, olaylar topluca işaretlenir", async () => {
  const { deps, log } = makeDeps({ queue: [ev(1, 100), ev(2, 100), ev(3, 101, 55), ev(4, 102)], failIds: [102] });
  const s = await runReconcile(deps);
  eq(log.fetched, [100, 101, 102], "GET sırası");
  eq(log.synced, [[1, 2], [3]], "başarılı olaylar");
  eq(log.failed.map((f) => [f.ids, f.error]), [[[4], "get_order_failed: http_500"]], "başarısız");
  eq(log.failed[0].next, ["2026-11-09T01:10:00.000Z"], "ilk deneme sonrası +10 dk");
  eq([s.queue.events, s.queue.orders, s.queue.ok, s.queue.failed, s.relinked], [4, 3, 2, 1, 3], "özet");
  eq(log.upserted.map((r) => r.channel), ["trendyol_go", "trendyol_go"], "kanal");
  if (JSON.stringify(log.upserted).includes("Gizli")) throw new Error("kişisel veri upsert'e gitti");
});

Deno.test("açık siparişler: kuyrukta işlenen tekrar çekilmez; batch sınırı", async () => {
  const { deps, log } = makeDeps({ queue: [ev(1, 100)], open: [100, 200, 201], config: { batch: 2 } });
  const s = await runReconcile(deps);
  eq(log.fetched, [100, 200, 201], "100 bir kez");
  eq([s.open.orders, s.open.ok], [2, 2], "açık 2");
});

Deno.test("liste uç noktası varsayılan KAPALI", async () => {
  const { deps, log } = makeDeps({ list: { data: [{ id: 1 }] } });
  const s = await runReconcile(deps);
  eq([s.list.enabled, log.listPaths.length], [false, 0], "çağrılmadı");
});

Deno.test("liste uç noktası açık: dünün listesi, yalnız eksikler eklenir", async () => {
  const { deps, log } = makeDeps({
    config: { list_endpoint_enabled: true },
    existing: [300],
    list: { status: 100, data: { orders: [{ id: 300 }, { id: 301 }, { id: 302, products: [{ productName: "X", quantity: 1, unitPrice: 5 }], orderTotal: 5 }] } },
  });
  const s = await runReconcile(deps);
  eq(log.listPaths, ["Orders?startDate=2026-11-08&endDate=2026-11-08"], "yol (İstanbul dün)");
  eq([s.list.listed, s.list.missing, s.list.added], [3, 2, 2], "özet");
  eq(log.fetched, [301], "tam öğe (302) için GET yok");
  eq(log.upserted.map((r) => r.adisyo_order_id).sort(), [301, 302], "eklenen");
});

Deno.test("liste hatası özetlenir, akış sürer", async () => {
  const { deps } = makeDeps({ config: { list_endpoint_enabled: true }, listFail: true });
  const s = await runReconcile(deps);
  eq([s.list.error, s.relinked], ["http_404", 3], "hata + relink");
});

Deno.test("zaman bütçesi aşılınca durur", async () => {
  const { deps } = makeDeps({ queue: [ev(1, 1), ev(2, 2), ev(3, 3)], config: { time_budget_ms: 5000 }, clockStepMs: 2000 });
  const s = await runReconcile(deps);
  if (!s.stopped_by_budget) throw new Error("durmalıydı");
  if (s.queue.orders >= 3) throw new Error("hepsini işlememeliydi");
});

Deno.test("mergeConfig sınırlar + yardımcılar", () => {
  const c = mergeConfig({ batch: 99999, delay_ms: -5, list_endpoint_enabled: "true" as unknown as boolean, list_endpoint_path: "/Orders/List" });
  eq([c.batch, c.delay_ms, c.list_endpoint_enabled, c.list_endpoint_path], [1000, 0, false, "Orders/List"], "sınırlar");
  eq(istanbulYesterday(new Date("2026-11-08T22:30:00Z")), "2026-11-08", "İstanbul 01:30 → dün 8 Kas");
  eq(istanbulYesterday(new Date("2026-11-08T20:30:00Z")), "2026-11-07", "İstanbul 23:30 → dün 7 Kas");
  eq(extractList({ data: [{ id: 1 }] }).length, 1);
  eq(extractList({ data: { items: [{ id: 1 }, { id: 2 }] } }).length, 2);
  eq(extractList([{ id: 1 }]).length, 1);
  eq(extractList({ data: { x: 1 } }).length, 0);
});
