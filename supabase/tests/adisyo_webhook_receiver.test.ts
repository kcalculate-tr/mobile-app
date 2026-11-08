// D-S1 — adisyo-webhook-receiver davranış testi (ağ / DB yok).
//
// Eski alıcı (fixtures/adisyo-webhook-receiver.before.ts = night17/camera'daki
// sürüm) ile yeni alıcı AYNI sahte Supabase + sahte Adisyo ile çalıştırılır:
//  · Uygulama siparişinde orders yazımları, webhook olay yazımları (ao_* hariç),
//    adisyo_api_log satırları ve HTTP yanıtı BAYT BAYT AYNI olmalı.
//  · Uygulama dışı siparişte yeni alıcı adisyo_orders'a (RPC) kişisel veri
//    içermeyen satır yazmalı, api_log'a gövde yazmamalı, hatada kuyruğa almalı.
//
// Çalıştırma:
//   deno test --no-check --no-config --import-map=supabase/tests/stubs/import_map.json \
//     --allow-env --allow-read supabase/tests/adisyo_webhook_receiver.test.ts
import { createHmac } from "node:crypto";
import type { FakeDb, Op } from "./stubs/supabase.ts";

const KEY = "test-webhook-key";
Deno.env.set("ADISYO_WEBHOOK_API_KEY", KEY);
Deno.env.set("ADISYO_API_KEY", "k");
Deno.env.set("ADISYO_API_SECRET", "s");
Deno.env.set("ADISYO_API_CONSUMER", "c");
Deno.env.set("SUPABASE_URL", "http://fake");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fake");

type Handler = (req: Request) => Promise<Response>;
const g = globalThis as unknown as { __handlers: Handler[]; __fakeDb: FakeDb };

await import("./fixtures/adisyo-webhook-receiver.before.ts");
await import("../functions/adisyo-webhook-receiver/index.ts");
const [oldHandler, newHandler] = g.__handlers;

// ── Sahte Adisyo ────────────────────────────────────────────────────────────
let adisyoMode: "ok" | "fail" | "status_err" = "ok";
let adisyoBody: Record<string, unknown> = {};
let adisyoCalls = 0;
globalThis.fetch = ((input: string | URL | Request) => {
  adisyoCalls++;
  const url = String(input instanceof Request ? input.url : input);
  if (!url.startsWith("https://ext.adisyo.com/")) throw new Error("beklenmeyen fetch: " + url);
  if (adisyoMode === "fail") return Promise.reject(new Error("ECONNRESET"));
  if (adisyoMode === "status_err") {
    return Promise.resolve(new Response(JSON.stringify({ status: 401, message: "unauthorized" }), { status: 200 }));
  }
  return Promise.resolve(new Response(JSON.stringify({ status: 100, message: "ok", data: adisyoBody }), { status: 200 }));
}) as typeof fetch;

const ORDER = (id: number, extra: Record<string, unknown> = {}) => ({
  id, status: "Teslimatta", statusId: 5, orderNumber: "N-" + id, orderTotal: 250, discountAmount: 0,
  taxAmount: 20, insertDate: "2026-11-08T12:00:00", restaurantKey: "rk-merkez",
  salesChannelName: "Paket Servis", externalAppName: "Yemeksepeti", confirmationCode: "YS-1",
  customer: { name: "Ayşe Yılmaz", phone: "05321234567", address: "Moda Cd" },
  customerLatitude: 40.9, customerLongitude: 29.0, orderNote: "Zili çalma 05321234567",
  products: [{ productName: "Bowl", quantity: 1, unitPrice: 250 }],
  ...extra,
});

function reset(orders: Array<[number, number]> = [], existing: Array<[string, boolean]> = []) {
  g.__fakeDb = {
    ops: [],
    ordersByAdisyoId: new Map(orders),
    existingEvents: new Map(existing.map(([e, p], i) => [e, { id: 900 + i, processed: p }])),
    nextEventId: 1,
    rpcError: null,
  };
  adisyoCalls = 0;
}

function req(eventType: string, eventId: string, adisyoOrderId: number | null, sign = true): Request {
  const eventTimeUtc = "2026-11-08T12:00:00Z";
  const body = JSON.stringify({ eventId, webhookEventType: eventType, eventTimeUtc, restaurantIdentity: "r-1", data: { id: adisyoOrderId } });
  const sig = createHmac("sha256", KEY).update(`${eventType}|${eventTimeUtc}|${KEY}`).digest("base64");
  return new Request("http://fake/fn", { method: "POST", body, headers: sign ? { "X-Adisyo-Signature": sig } : {} });
}

async function run(h: Handler, r: () => Request) {
  const res = await h(r());
  const text = await res.text();
  const ops = g.__fakeDb.ops;
  return { status: res.status, text, ops, adisyoCalls };
}

/** Eski alıcının da yaptığı işlemler: ao_* yan yazımları ve rpc hariç. */
function legacyView(ops: Op[]): Op[] {
  return ops.filter((o) => {
    if (o.table.startsWith("rpc:")) return false;
    if (o.table === "adisyo_webhook_events" && o.op === "update") {
      const keys = Object.keys(o.payload as object);
      if (keys.every((k) => k.startsWith("ao_"))) return false;
    }
    return true;
  });
}

function eq(a: unknown, b: unknown, msg: string) {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error(`${msg}\n  eski: ${y}\n  yeni: ${x}`);
}

// Zaman damgaları (processed_at) çalıştırmalar arasında farklı: karşılaştırmada sabitle.
function normalizeTimes(ops: Op[]): Op[] {
  return JSON.parse(JSON.stringify(ops).replace(/"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z"/g, '"<ts>"')
    .replace(/"duration_ms":\d+/g, '"duration_ms":0'));
}

async function compareApp(name: string, setup: () => void, r: () => Request) {
  setup();
  const a = await run(oldHandler, r);
  setup();
  const b = await run(newHandler, r);
  eq(b.status, a.status, `${name}: HTTP kodu`);
  eq(b.text, a.text, `${name}: yanıt gövdesi`);
  eq(normalizeTimes(legacyView(b.ops)), normalizeTimes(a.ops), `${name}: DB yazımları`);
  eq(b.adisyoCalls, a.adisyoCalls, `${name}: Adisyo çağrı sayısı`);
  return b;
}

// ── Uygulama siparişi: eski = yeni ──────────────────────────────────────────
Deno.test("uygulama siparişi order.updated: eskisiyle bayt bayt aynı + yan upsert", async () => {
  adisyoMode = "ok"; adisyoBody = ORDER(500);
  const b = await compareApp("app updated", () => reset([[500, 42]]), () => req("order.updated", "e1", 500));
  const ordersUpd = b.ops.filter((o) => o.table === "orders" && o.op === "update");
  eq(ordersUpd.map((o) => o.payload), [{ status: "on_way" }], "orders.status on_way");
  const rpc = b.ops.filter((o) => o.table === "rpc:adisyo_order_upsert");
  if (rpc.length !== 1) throw new Error("yan upsert 1 kez olmalı");
  const s = JSON.stringify(rpc[0].payload);
  if (/Ayşe|0532|Moda|40\.9|Zili/.test(s)) throw new Error("upsert'e kişisel veri gitti: " + s);
});

Deno.test("uygulama siparişi: diğer yollar da aynı (created / GET hata / Adisyo hata / bilinmeyen durum)", async () => {
  adisyoMode = "ok"; adisyoBody = ORDER(501);
  let b = await compareApp("app created", () => reset([[501, 43]]), () => req("order.created", "e2", 501));
  eq(b.ops.filter((o) => o.table.startsWith("rpc:")).length, 0, "created'da yan upsert yok");

  adisyoMode = "fail";
  b = await compareApp("app GET network", () => reset([[502, 44]]), () => req("order.updated", "e3", 502));
  eq(b.ops.filter((o) => o.table.startsWith("rpc:")).length, 0, "GET hatasında upsert yok");

  adisyoMode = "status_err";
  await compareApp("app adisyo status", () => reset([[503, 45]]), () => req("order.updated", "e4", 503));

  adisyoMode = "ok"; adisyoBody = ORDER(504, { statusId: 42, status: "Garip" });
  await compareApp("app unknown status", () => reset([[504, 46]]), () => req("order.updated", "e5", 504));
});

Deno.test("imzasız / tekrar / eksik id / bilinmeyen tür: aynı", async () => {
  adisyoMode = "ok"; adisyoBody = ORDER(600);
  await compareApp("imza yok", () => reset([[600, 50]]), () => req("order.updated", "e6", 600, false));
  await compareApp("tekrar olay", () => reset([[600, 50]], [["e7", true]]), () => req("order.updated", "e7", 600));
  await compareApp("id yok", () => reset(), () => req("order.updated", "e8", null));
  await compareApp("stock", () => reset(), () => req("stock.depleted", "e9", null));
  await compareApp("bilinmeyen", () => reset(), () => req("foo.bar", "e10", 600));
  await compareApp("imza yok, uygulama dışı", () => reset(), () => req("order.created", "e11", 777, false));
});

// ── Uygulama dışı sipariş: yeni davranış ────────────────────────────────────
Deno.test("uygulama dışı order.updated → adisyo_orders upsert, kişisel veri yok", async () => {
  adisyoMode = "ok"; adisyoBody = ORDER(700);
  reset();
  const b = await run(newHandler, () => req("order.updated", "x1", 700));
  const body = JSON.parse(b.text);
  eq([b.status, body.ok, body.processed, body.process_error, body.order_id], [200, true, true, null, null], "yanıt");
  eq(b.ops.filter((o) => o.table === "orders" && o.op !== "select").length, 0, "orders'a yazım YOK");
  const rpc = b.ops.find((o) => o.table === "rpc:adisyo_order_upsert");
  const p = (rpc?.payload as { p: Record<string, unknown> }).p;
  eq([p.adisyo_order_id, p.channel, p.total, p.order_number, p.restaurant_key], [700, "yemeksepeti", 250, "N-700", "rk-merkez"], "satır");
  if (/Ayşe|0532|Moda|40\.9|Zili|customer/.test(JSON.stringify(p))) throw new Error("kişisel veri: " + JSON.stringify(p));
  const log = b.ops.filter((o) => o.table === "adisyo_api_log");
  eq(log.length, 1, "tek api_log satırı");
  eq((log[0].payload as Record<string, unknown>).response_body, null, "api_log gövdesiz");
  eq((log[0].payload as Record<string, unknown>).event_type, "GetOrder.external", "api_log türü");
  const ao = b.ops.find((o) => o.table === "adisyo_webhook_events" && o.op === "update" && "ao_synced_at" in (o.payload as object));
  if (!ao) throw new Error("ao_synced_at yazılmadı");
});

Deno.test("uygulama dışı order.created de yazılır", async () => {
  adisyoMode = "ok"; adisyoBody = ORDER(701, { externalAppName: "Getir" });
  reset();
  const b = await run(newHandler, () => req("order.created", "x2", 701));
  const rpc = b.ops.find((o) => o.table === "rpc:adisyo_order_upsert");
  eq((rpc?.payload as { p: Record<string, unknown> }).p.channel, "getir", "kanal getir");
});

Deno.test("uygulama dışı GET hatası → process_error + yeniden deneme kuyruğu", async () => {
  adisyoMode = "fail";
  reset();
  const b = await run(newHandler, () => req("order.updated", "x3", 702));
  const body = JSON.parse(b.text);
  eq([b.status, body.processed], [200, false], "200 + processed=false");
  if (!String(body.process_error).startsWith("adisyo_orders_sync_failed: get_order_failed")) throw new Error(body.process_error);
  const ao = b.ops.find((o) => o.table === "adisyo_webhook_events" && o.op === "update" && "ao_attempts" in (o.payload as object));
  const pl = ao?.payload as Record<string, unknown>;
  eq(pl?.ao_attempts, 1, "ao_attempts=1");
  const next = Date.parse(String(pl?.ao_next_retry_at));
  if (!(next > Date.now() + 8 * 60_000)) throw new Error("ao_next_retry_at ~10 dk sonra olmalı");
});

Deno.test("upsert RPC hatası → kuyruk; uygulama siparişinde sonuç değişmez", async () => {
  adisyoMode = "ok"; adisyoBody = ORDER(703);
  reset();
  g.__fakeDb.rpcError = "boom";
  let b = await run(newHandler, () => req("order.updated", "x4", 703));
  eq(JSON.parse(b.text).process_error, "adisyo_orders_sync_failed: upsert_failed: boom", "dış sipariş hata");

  adisyoBody = ORDER(504);
  await compareApp("app + rpc hatası", () => { reset([[504, 46]]); g.__fakeDb.rpcError = "boom"; }, () => req("order.updated", "x5", 504));
  b = { ...b };
});
