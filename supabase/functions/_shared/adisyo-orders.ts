// supabase/functions/_shared/adisyo-orders.ts
//
// D-S1 — Adisyo'daki TÜM siparişleri (uygulama + Yemeksepeti + Trendyol Go +
// Getir + Migros + salon + telefon) `public.adisyo_orders` tablosuna yazmak için
// SAF (yan etkisiz) yardımcılar. adisyo-webhook-receiver ve adisyo-reconcile
// ikisi de bunu kullanır; birim testi: supabase/tests/adisyo_orders.test.ts
//
// KİŞİSEL VERİ YOK: müşteri adı, telefon, adres, konum, sipariş notu, kurye /
// garson adı SATIRA ALINMAZ. Yalnız aşağıdaki BEYAZ LİSTE alanlar okunur;
// GET /Order yanıtının geri kalanı hiçbir yere kopyalanmaz. Aynı beyaz liste
// SQL tarafında `adisyo_order_upsert(jsonb)` içinde de tekrar uygulanır.

export type AdisyoChannel =
  | "app"
  | "yemeksepeti"
  | "trendyol_go"
  | "getir"
  | "migros"
  | "salon"
  | "telefon"
  | "diger";

export const ADISYO_CHANNELS: readonly AdisyoChannel[] = [
  "app", "yemeksepeti", "trendyol_go", "getir", "migros", "salon", "telefon", "diger",
];

export interface AdisyoOrderItem {
  name: string;
  quantity: number;
  unit_price: number | null;
  product_id: number | null;
}

export interface AdisyoOrderRow {
  adisyo_order_id: number;
  order_number: string | null;
  restaurant_key: string | null;
  channel: AdisyoChannel;
  channel_raw: string | null;
  status_id: number | null;
  order_type: string | null;
  total: number | null;
  discount: number | null;
  tax: number | null;
  payment_method: string | null;
  inserted_at: string | null;
  closed_at: string | null;
  prepared_at: string | null;
  is_cancelled: boolean;
  cancel_reason: string | null;
  external_ref: string | null;
  items: AdisyoOrderItem[];
  raw_hash: string;
}

// ─── Kanal normalize ────────────────────────────────────────────────────────

/** Türkçe karakterleri sadeleştirip küçük harfe çevirir ("İ"→"i", "ş"→"s"…). */
export function foldTr(s: string): string {
  return s
    .replace(/İ/g, "i").replace(/I/g, "ı")
    .toLowerCase()
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Sıra önemli: ilk eşleşen kazanır. Pazar yerleri önce (ör. "Yemeksepeti
// Paket" → yemeksepeti, "paket" yüzünden telefon OLMAZ).
const CHANNEL_RULES: Array<[AdisyoChannel, RegExp]> = [
  ["yemeksepeti", /\b(yemek ?sepeti|ys ?(market|express)?|banabi|delivery ?hero)\b/],
  ["trendyol_go", /\b(trendyol|ty ?go|tgo)\b/],
  ["getir",       /\bgetir/],
  ["migros",      /\bmigros|\bmigrosyemek|\bmigros ?hemen/],
  ["app",         /\b(kcal|eatkcal|kcalculate|mobil ?uygulama|uygulama|web ?siparis|online ?siparis)\b/],
  ["telefon",     /\b(telefon|tel|phone|cagri|call ?center|whatsapp|paket ?servis)\b/],
  ["salon",       /\b(salon|masa|restoran|restaurant|dine ?in|gel ?al|take ?away|kasa|self ?servis|pos)\b/],
];

/**
 * Adisyo kanal alanlarını tek bir kanal koduna indirger.
 * Öncelik: externalAppName → salesChannelName → (ad yoksa) orderType/tableName.
 * Uygulama siparişi kesin olarak SQL tarafında `orders.adisyo_order_id`
 * eşleşmesiyle 'app' yapılır; buradaki 'app' yalnız ada dayalı ipucudur.
 */
export function normalizeChannel(input: {
  salesChannelName?: unknown;
  externalAppName?: unknown;
  orderType?: unknown;
  orderTypeId?: unknown;
  tableName?: unknown;
}): AdisyoChannel {
  const names = [input.externalAppName, input.salesChannelName]
    .map((v) => (typeof v === "string" ? foldTr(v) : ""))
    .filter(Boolean);

  for (const name of names) {
    for (const [ch, re] of CHANNEL_RULES) {
      if (re.test(name)) return ch;
    }
  }
  // Ad var ama tanınmadıysa: masa adı varsa salon, yoksa diger.
  const table = typeof input.tableName === "string" ? input.tableName.trim() : "";
  if (names.length > 0) return table ? "salon" : "diger";

  // Hiç kanal adı yok → sipariş tipine bak (Adisyo: 1 masa, 2 paket, 3 gel-al).
  if (table) return "salon";
  const typeId = toInt(input.orderTypeId);
  const typeName = typeof input.orderType === "string" ? foldTr(input.orderType) : "";
  if (typeId === 1 || /\b(masa|salon|table)\b/.test(typeName)) return "salon";
  if (typeId === 3 || /\bgel ?al|take ?away\b/.test(typeName)) return "salon";
  if (typeId === 2 || /\bpaket|delivery\b/.test(typeName)) return "telefon";
  return "diger";
}

// ─── Yardımcılar ────────────────────────────────────────────────────────────

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toInt(v: unknown): number | null {
  const n = toNum(v);
  return n === null ? null : Math.trunc(n);
}

function toStr(v: unknown, max = 120): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

/** Değeri "kişisel veri olabilir" diye reddetmek için: telefon/e-posta deseni. */
function looksPersonal(s: string): boolean {
  if (/@/.test(s)) return true;
  if (/(\+?90)?\s*\(?0?5\d{2}\)?[\s-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/.test(s)) return true;
  return false;
}

/**
 * Adisyo tarihleri: ISO (Z/ofsetli) gelirse olduğu gibi; ofsetsiz
 * "2026-10-13T10:41:00" ya da "13.10.2026 10:41" gelirse İstanbul saati
 * (+03:00, Türkiye 2016'dan beri yaz saati uygulamıyor) kabul edilir.
 */
export function parseAdisyoDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  if (/^0001-01-01/.test(s)) return null; // .NET boş tarih
  let iso = s;
  const tr = s.match(/^(\d{2})\.(\d{2})\.(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (tr) iso = `${tr[3]}-${tr[2]}-${tr[1]}T${tr[4]}:${tr[5]}:${tr[6] ?? "00"}`;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(iso) && !/(Z|[+-]\d{2}:?\d{2})$/.test(iso)) {
    iso = iso.replace(" ", "T") + "+03:00";
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    iso = iso + "T00:00:00+03:00";
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function pick(o: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (o[k] !== undefined && o[k] !== null) return o[k];
    const pascal = k.charAt(0).toUpperCase() + k.slice(1);
    if (o[pascal] !== undefined && o[pascal] !== null) return o[pascal];
  }
  return undefined;
}

/** GET /Order zarfını açar: { status, message, data:{…} } ya da doğrudan sipariş. */
export function unwrapOrderBody(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const inner = b.data && typeof b.data === "object" && !Array.isArray(b.data)
    ? (b.data as Record<string, unknown>)
    : b;
  return inner;
}

export function mapItems(products: unknown): AdisyoOrderItem[] {
  if (!Array.isArray(products)) return [];
  const out: AdisyoOrderItem[] = [];
  for (const p of products.slice(0, 200)) {
    if (!p || typeof p !== "object") continue;
    const r = p as Record<string, unknown>;
    const name = toStr(pick(r, "productName", "name", "productUnitName", "title"), 120);
    if (!name || looksPersonal(name)) continue;
    const qty = toNum(pick(r, "quantity", "count", "amount", "qty")) ?? 1;
    let unit = toNum(pick(r, "unitPrice", "price", "salePrice"));
    const lineTotal = toNum(pick(r, "totalPrice", "total", "lineTotal"));
    if (unit === null && lineTotal !== null && qty) unit = Math.round((lineTotal / qty) * 100) / 100;
    out.push({
      name,
      quantity: qty,
      unit_price: unit,
      product_id: toInt(pick(r, "productUnitId", "productId", "id")),
    });
  }
  return out;
}

function paymentMethodOf(o: Record<string, unknown>): string | null {
  const direct = toStr(pick(o, "paymentMethodName"), 60);
  if (direct) return direct;
  const pays = pick(o, "payments");
  if (Array.isArray(pays) && pays.length) {
    const names = new Set<string>();
    for (const p of pays) {
      if (p && typeof p === "object") {
        const n = toStr(pick(p as Record<string, unknown>, "paymentMethodName", "paymentTypeName", "name"), 60);
        if (n) names.add(n);
      }
    }
    if (names.size) return [...names].join(" + ").slice(0, 120);
  }
  return null;
}

const CANCEL_STATUS_IDS = new Set([8, 9]);

export function isCancelledOrder(o: Record<string, unknown>): { cancelled: boolean; reason: string | null } {
  const reasonRaw = toStr(pick(o, "orderCancelReason", "cancelReason"), 200);
  const reason = reasonRaw && !looksPersonal(reasonRaw) ? reasonRaw : (reasonRaw ? "[gizlendi]" : null);
  const statusId = toInt(pick(o, "statusId"));
  const statusStr = foldTr(String(pick(o, "status") ?? ""));
  const cancelled = Boolean(reason) ||
    (statusId !== null && CANCEL_STATUS_IDS.has(statusId)) ||
    /\b(iptal|cancel)/.test(statusStr);
  return { cancelled, reason };
}

/** Kararlı JSON (anahtar sırası sabit) → raw_hash girdisi. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * GET /Order/{id} yanıtı → adisyo_orders satırı (kişisel veri ayıklanmış).
 * raw_hash yalnız SAKLANAN alanlardan hesaplanır: aynı sipariş tekrar gelirse
 * (aynı olay ya da değişmeyen sipariş) satır güncellenmez.
 */
export async function toAdisyoOrderRow(
  body: unknown,
  fallbackId?: number | null,
): Promise<AdisyoOrderRow | null> {
  const o = unwrapOrderBody(body);
  if (!o) return null;
  const id = toInt(pick(o, "id", "orderId")) ?? (fallbackId ?? null);
  if (!id) return null;

  const salesChannelName = pick(o, "salesChannelName");
  const externalAppName = pick(o, "externalAppName");
  const { cancelled, reason } = isCancelledOrder(o);
  const channelRaw = [externalAppName, salesChannelName]
    .map((v) => toStr(v, 60)).filter(Boolean).join(" / ") || null;

  const rowNoHash = {
    adisyo_order_id: id,
    order_number: toStr(pick(o, "orderNumber"), 40),
    restaurant_key: toStr(pick(o, "restaurantKey"), 80),
    channel: normalizeChannel({
      salesChannelName,
      externalAppName,
      orderType: pick(o, "orderType"),
      orderTypeId: pick(o, "orderTypeId"),
      tableName: pick(o, "tableName"),
    }),
    channel_raw: channelRaw,
    status_id: toInt(pick(o, "statusId")),
    order_type: toStr(pick(o, "orderType", "orderTypeId"), 40),
    total: toNum(pick(o, "orderTotal", "total")),
    discount: toNum(pick(o, "discountAmount")),
    tax: toNum(pick(o, "taxAmount")),
    payment_method: paymentMethodOf(o),
    inserted_at: parseAdisyoDate(pick(o, "insertDate")),
    closed_at: parseAdisyoDate(pick(o, "closedDate")),
    prepared_at: parseAdisyoDate(pick(o, "preparedDate")),
    is_cancelled: cancelled,
    cancel_reason: reason,
    // Pazar yeri sipariş kodu (kişisel değil): orders.external_code ile
    // çift sayımı önlemek için.
    external_ref: toStr(pick(o, "confirmationCode", "externalOrderId", "externalAppNumericId"), 80),
    items: mapItems(pick(o, "products")),
  };
  const raw_hash = await sha256Hex(stableStringify(rowNoHash));
  return { ...rowNoHash, raw_hash };
}

/** Yeniden deneme bekleme süresi (dk): 10, 20, 40 … en çok 12 saat. */
export function retryDelayMinutes(attempts: number): number {
  const a = Math.max(0, Math.min(attempts, 10));
  return Math.min(10 * 2 ** a, 720);
}

// ─── Adisyo HTTP (yan etkili; test dışı) ────────────────────────────────────

export const ADISYO_BASE = "https://ext.adisyo.com/api/External/v2";

export interface AdisyoCreds { apiKey: string; apiSecret: string; apiConsumer: string }

/**
 * GET /Order/{id}. Yanıt gövdesi ÇAĞIRANA döner, burada hiçbir yere
 * yazılmaz (kişisel veri içerir).
 */
export async function fetchAdisyoOrderRaw(
  creds: AdisyoCreds,
  adisyoOrderId: number,
): Promise<{ ok: boolean; status: number | null; body: unknown; error: string | null; ms: number }> {
  const t0 = Date.now();
  try {
    const resp = await fetch(`${ADISYO_BASE}/Order/${adisyoOrderId}`, {
      method: "GET",
      headers: {
        "x-api-key": creds.apiKey,
        "x-api-secret": creds.apiSecret,
        "x-api-consumer": creds.apiConsumer,
      },
    });
    let body: unknown = null;
    try { body = await resp.json(); } catch { body = null; }
    const env = body as Record<string, unknown> | null;
    const st = env?.status;
    if (!resp.ok) return { ok: false, status: resp.status, body, error: `http_${resp.status}`, ms: Date.now() - t0 };
    if (typeof st === "number" && st !== 100) {
      return { ok: false, status: resp.status, body, error: `adisyo_status_${st}: ${String(env?.message ?? "unknown").slice(0, 120)}`, ms: Date.now() - t0 };
    }
    return { ok: true, status: resp.status, body, error: null, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, status: null, body: null, error: `network: ${String(e).slice(0, 200)}`, ms: Date.now() - t0 };
  }
}
