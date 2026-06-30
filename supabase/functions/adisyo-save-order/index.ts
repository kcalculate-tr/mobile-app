// supabase/functions/adisyo-save-order/index.ts
//
// FAZ 1: SaveOrder + Prepared akışı, defansif logging, retry desteği.
//
// Tetiklenme:
//   - DB trigger: status='confirmed'a geçişte (yeni sipariş)
//   - DB trigger: adisyo_sync_status='retrying' geçişinde (cron retry)
//   - Manuel: { order_id: N } body ile (debug)
//
// Akış:
//   1. orders satırını oku, guard'ları kontrol et
//   2. attempts++, last_attempt_at=now() yaz
//   3. SaveOrder payload hazırla + adisyo_api_log'a log at
//   4. POST /SaveOrder
//   5. Başarısız → adisyo_sync_status='failed', return 200
//   6. Başarılı → adisyo_order_id yaz, sync_status='saved'
//   7. 1.5sn bekle (Adisyo indexlemesi için)
//   8. POST /Prepared (sipariş kabul)
//   9. Başarılıysa sync_status='success', orders.status='preparing'
//   10. Başarısızsa sync_status='failed' (SaveOrder yapıldı ama Prepared olmadı)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ADISYO_API_KEY      = Deno.env.get("ADISYO_API_KEY")!;
const ADISYO_API_SECRET   = Deno.env.get("ADISYO_API_SECRET")!;
const ADISYO_API_CONSUMER = Deno.env.get("ADISYO_API_CONSUMER")!;
const ADISYO_PAYMENT_METHOD_ID = parseInt(Deno.env.get("ADISYO_PAYMENT_METHOD_ID") ?? "61");
const SUPABASE_URL        = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ADISYO_BASE = "https://ext.adisyo.com/api/External/v2";
const PREPARED_DELAY_MS = 1500;

type SyncStatus = "pending" | "retrying" | "saved" | "success" | "failed" | "skipped";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  selected_options?: { labels?: string[]; extraPrice?: number };
  // Bundle ürünlerde mobil app seçimleri yalnızca buraya yazıyor;
  // selected_options boş kalıyor → not için fallback bu alandan okunur.
  legacy_selected_options?: { labels?: string[] };
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const order = payload.record ?? payload;
  const orderId = order?.id ?? payload.order_id;
  if (!orderId) return json({ error: "missing_order_id" }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // === 1. Sipariş oku
  const { data: dbOrder, error: orderErr } = await supabase
    .from("orders").select("*").eq("id", orderId).single();

  if (orderErr || !dbOrder) {
    return json({ error: "order_not_found", order_id: orderId, detail: orderErr?.message }, 404);
  }

  // === 2. Guard'lar
  if (dbOrder.payment_status !== "paid") {
    return json({ skipped: "not_paid", payment_status: dbOrder.payment_status });
  }
  if (!["confirmed", "preparing", "on_way", "delivered"].includes(dbOrder.status)) {
    return json({ skipped: "wrong_status", status: dbOrder.status });
  }
  if (dbOrder.adisyo_order_id && dbOrder.adisyo_sync_status === "success") {
    return json({ skipped: "already_synced", adisyo_order_id: dbOrder.adisyo_order_id });
  }
  if ((dbOrder.adisyo_sync_attempts ?? 0) >= 5) {
    return json({ skipped: "max_attempts", attempts: dbOrder.adisyo_sync_attempts });
  }

  // === 3. attempts++, last_attempt_at=now()
  const newAttempts = (dbOrder.adisyo_sync_attempts ?? 0) + 1;
  await supabase.from("orders").update({
    adisyo_sync_attempts: newAttempts,
    adisyo_last_attempt_at: new Date().toISOString(),
  }).eq("id", orderId);

  // === 4. Items işle
  const items = (dbOrder.items ?? []) as OrderItem[];
  if (!Array.isArray(items) || items.length === 0) {
    return await fail(supabase, orderId, "no_items_in_order", null);
  }

  const productIds = items.map(it => parseInt(it.id, 10)).filter(n => !Number.isNaN(n));
  const { data: products, error: prodErr } = await supabase
    .from("products").select("id, name, price, adisyo_product_unit_id").in("id", productIds);

  if (prodErr) return await fail(supabase, orderId, `products_fetch: ${prodErr.message}`, null);

  const unitIdMap = new Map<number, number>();
  // Adisyo, satır toplamını KENDİ katalog/liste fiyatından doğrular (gönderdiğimiz UnitPrice'ı
  // yok sayar — kanıt: order #41). Bu yüzden UnitPrice olarak DÜZ katalog fiyatı (products.price)
  // yollarız; products.price Adisyo kataloğuyla senkron tutulur (update-prices-v4).
  const catalogPriceMap = new Map<number, number>();
  for (const p of products ?? []) {
    if (p.adisyo_product_unit_id) unitIdMap.set(p.id as number, p.adisyo_product_unit_id as number);
    if (p.price != null) catalogPriceMap.set(p.id as number, Number(p.price));
  }

  const orderDetails: Array<{ ProductUnitId: number; Quantity: number; UnitPrice: number; OrderDetailNote?: string }> = [];
  const unmapped: string[] = [];
  const noPrice: string[] = [];

  for (const it of items) {
    const pid = parseInt(it.id, 10);
    const unitId = unitIdMap.get(pid);
    if (!unitId) { unmapped.push(`${it.name} (id=${it.id})`); continue; }
    const catalogPrice = catalogPriceMap.get(pid);
    if (catalogPrice == null) { noPrice.push(`${it.name} (id=${it.id})`); continue; }
    // Kaynak fallback: bundle siparişlerde labels legacy_selected_options'ta;
    // selected_options boş kalıyor (gerçek app siparişleri). Dolu olandan oku.
    const labels = it.selected_options?.labels
                ?? it.legacy_selected_options?.labels
                ?? [];
    // Adisyo fişinde grup öneğini ("Baz Seçimi: ") soy → sadece seçilen değer kalsın
    // ("Basmati"). ":" yoksa label'ı olduğu gibi bırak (güvenli). Fiş daha kısa/temiz.
    const cleanLabels = labels.map((l) => {
      const i = l.indexOf(":");
      return i >= 0 ? l.slice(i + 1).trim() : l;
    });
    orderDetails.push({
      ProductUnitId: unitId,
      Quantity: it.quantity,
      // DÜZ katalog fiyatı (indirimsiz, extraPrice HARİÇ). %5 ürün indirimi + kupon + opsiyon
      // farkları aşağıda toplu Discount'a yıkılır. extraPrice'ı buraya eklemek Adisyo'nun
      // düz katalog kontrolünü aşar → 715 (bkz. order #41).
      UnitPrice: catalogPrice,
      // Ayraç " | ": \n Adisyo word-wrap'iyle çakışıp satırları üst üste bindiriyordu;
      // pipe ile tek akan satır, Adisyo kendi sarmasını düzgün yapıyor.
      ...(cleanLabels.length > 0 ? { OrderDetailNote: cleanLabels.join(" | ") } : {}),
    });
  }

  if (unmapped.length > 0) {
    return await fail(supabase, orderId, `unmapped_products: ${unmapped.join("; ")}`, null);
  }
  if (noPrice.length > 0) {
    return await fail(supabase, orderId, `no_catalog_price: ${noPrice.join("; ")}`, null);
  }

  // === 5. Adres zenginleştirme (addresses tablosundan) + müşteri ad/soyad
  const addr = await getEnrichedAddress(supabase, dbOrder);

  const customerName = pickFirstName(addr, dbOrder);
  const customerSurname = pickLastName(addr, dbOrder);

  const composedAddress = composeAddress(addr, dbOrder);
  const cityValue = (addr?.city ?? dbOrder.city ?? "İzmir").toString().trim() || "İzmir";
  const regionValue = (addr?.district ?? dbOrder.district ?? "").toString().trim();
  const neighborhoodValue = (addr?.neighbourhood ?? addr?.neighborhood ?? "").toString().trim();
  const phoneValue = (addr?.contact_phone ?? dbOrder.phone ?? "").toString().trim();

  // === 6. Tutarlar
  // Adisyo kontrolü: Σ(katalog_fiyatı × qty) == OrderTotal + Discount − DeliveryFee.
  // UnitPrice = düz katalog fiyatı (yukarıda), OrderTotal = net ödenen (total_amount).
  // Discount = TÜM indirimi tek kalemde topla (ürün %5 + kupon + opsiyon farkları):
  //   Discount = items_sum(katalog) + DeliveryFee − OrderTotal
  // Böylece denklem inşa gereği kapanır. Premium opsiyon net>katalog yaparsa Discount
  // negatif olur (Adisyo kabul ediyor — kanıt: order #45).
  const deliveryFee = Number(dbOrder.delivery_fee ?? 0);
  const orderTotal = Number(dbOrder.total_amount ?? 0);
  const itemsSum = orderDetails.reduce((s, d) => s + d.UnitPrice * d.Quantity, 0);
  const discount = Math.round((itemsSum + deliveryFee - orderTotal) * 100) / 100;

  // Gözlemlenebilirlik: hesaplanan Discount, DB'deki bilinen indirimlerden (kupon + makro)
  // beklenenden çok saparsa logla (katalog fiyatı bayatsa burada yakalanmasa da iz kalır).
  const knownDiscount = Number(dbOrder.discount_amount ?? 0) + Number(dbOrder.macro_discount_amount ?? 0);
  await logEvent(supabase, orderId, "info",
    { itemsSum, orderTotal, deliveryFee, computedDiscount: discount, knownDiscount }, null, null,
    `discount_calc: items_sum(katalog)=${itemsSum} net=${orderTotal} → Discount=${discount} (kupon/makro=${knownDiscount})`, null);

  // === 7. Sipariş notu
  const noteParts: string[] = [];
  if (dbOrder.delivery_type === "scheduled" && dbOrder.scheduled_date) {
    const time = dbOrder.scheduled_time ? ` ${String(dbOrder.scheduled_time).substring(0, 5)}` : "";
    noteParts.push(`[Randevulu: ${dbOrder.scheduled_date}${time}]`);
  }
  if (dbOrder.note) noteParts.push(dbOrder.note);
  const orderNote = noteParts.join(" ");

  // === 8. Adisyo SaveOrder payload
  const saveOrderPayload = {
    CustomerName: customerName,
    CustomerSurname: customerSurname,
    CustomerId: dbOrder.user_id ?? dbOrder.order_uuid ?? `order-${orderId}`,
    CustomerPhone: phoneValue,
    Address: composedAddress || dbOrder.address || "Adres belirtilmedi",
    AddressDescription: (dbOrder.address_description ?? "").toString(),
    Region: regionValue,
    Neighborhood: neighborhoodValue,
    City: cityValue,
    PaymentMethodId: ADISYO_PAYMENT_METHOD_ID,
    PaymentNote: `KCAL App / ${dbOrder.payment_provider ?? "paytr"}`,
    Discount: discount,
    OrderTotal: orderTotal,
    DeliveryFee: deliveryFee,
    OrderNote: orderNote,
    WebOrderId: dbOrder.order_code ?? `KCAL-${orderId}`,
    OrderType: 3,
    OrderDetails: orderDetails,
  };

  // === 9. SaveOrder POST + log
  const saveOrderRes = await callAdisyo(supabase, orderId, "SaveOrder", `${ADISYO_BASE}/SaveOrder`, saveOrderPayload);
  if (!saveOrderRes.ok) {
    return await fail(supabase, orderId, saveOrderRes.errorMsg, saveOrderPayload);
  }

  const adisyoOrderId = saveOrderRes.body?.orderId ?? null;
  // status 100 = başarılı; 713 = "bu sipariş numarası zaten mevcut" (idempotent)
  const isDuplicate = saveOrderRes.body?.status === 713;

  // === 10. Başarı: SaveOrder yeterli, Prepared geçici olarak devre dışı
  // Hipotez: Prepared çağrısı Adisyo'da "Hazırlandı"ya geçiriyor; sipariş "Hazırlanıyor"
  // panelinde görünmüyor. SaveOrder tek başına "Hazırlanıyor"a düşürmeli (regresyon testi).
  // Test sonucuna göre kalıcı kararlaştırılacak.
  //
  // await new Promise(r => setTimeout(r, PREPARED_DELAY_MS));
  // const preparedPayload = { orderId: adisyoOrderId };
  // const preparedRes = await callAdisyo(supabase, orderId, "Prepared", `${ADISYO_BASE}/Prepared`, preparedPayload);
  // if (!preparedRes.ok) {
  //   return await fail(supabase, orderId, `prepared_failed: ${preparedRes.errorMsg}`, preparedPayload);
  // }

  await supabase.from("orders").update({
    adisyo_order_id: adisyoOrderId,
    adisyo_sync_status: "success",
    adisyo_synced_at: new Date().toISOString(),
    adisyo_sync_error: null,
    status: "preparing",
  }).eq("id", orderId);

  return json({
    ok: true,
    adisyo_order_id: adisyoOrderId,
    duplicate: isDuplicate,
    attempts: newAttempts,
  });
});

// --- helpers ---

async function callAdisyo(
  supabase: SupabaseClient,
  orderId: number | string,
  eventName: string,
  url: string,
  body: unknown,
): Promise<{ ok: boolean; body?: any; errorMsg: string }> {
  const t0 = Date.now();
  await logEvent(supabase, orderId, `${eventName}.request`, body, null, null, null, null);

  let respBody: any = null;
  let respStatus: number | null = null;
  let errMsg: string | null = null;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": ADISYO_API_KEY,
        "x-api-secret": ADISYO_API_SECRET,
        "x-api-consumer": ADISYO_API_CONSUMER,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    respStatus = resp.status;
    try { respBody = await resp.json(); } catch { respBody = null; }
  } catch (err) {
    errMsg = `network: ${String(err)}`;
  }

  const duration = Date.now() - t0;
  await logEvent(supabase, orderId, `${eventName}.response`, body, respStatus, respBody, errMsg, duration);

  if (errMsg) return { ok: false, errorMsg: errMsg };

  // Adisyo "status": 100 = başarılı, 713 = duplicate (idempotent başarı)
  const adisyoStatus = respBody?.status;
  const isOk = adisyoStatus === 100 || adisyoStatus === 713;

  if (!isOk) {
    return {
      ok: false,
      body: respBody,
      errorMsg: `adisyo_status_${adisyoStatus}: ${respBody?.message ?? "unknown"}`,
    };
  }

  return { ok: true, body: respBody, errorMsg: "" };
}

async function logEvent(
  supabase: SupabaseClient,
  orderId: number | string,
  eventType: string,
  requestBody: unknown,
  responseStatus: number | null,
  responseBody: unknown,
  errorMessage: string | null,
  durationMs: number | null,
) {
  try {
    await supabase.from("adisyo_api_log").insert({
      order_id: orderId,
      event_type: eventType,
      request_body: requestBody as any,
      response_status: responseStatus,
      response_body: responseBody as any,
      error_message: errorMessage,
      duration_ms: durationMs,
    });
  } catch (e) {
    console.error("adisyo_api_log insert failed:", e);
  }
}

async function fail(
  supabase: SupabaseClient,
  orderId: number | string,
  errorMsg: string,
  payloadSent: unknown,
) {
  await supabase.from("orders").update({
    adisyo_sync_status: "failed",
    adisyo_sync_error: errorMsg,
  }).eq("id", orderId);

  return json({ error: "adisyo_failed", detail: errorMsg, payload_sent: payloadSent }, 200);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// --- adres zenginleştirme ---

// Adisyo SaveOrder için orders satırına bağlı zengin adres kaydını döner.
// Öncelik: orders.address_id ile direkt JOIN.
// Fallback: kullanıcının en son oluşturduğu adres (mobile create flow şu an
// address_id'yi yazmıyor — tek adresi olan kullanıcılar için sorunsuz, çoklu
// adres olanlar için "son oluşturulan" heuristic'i kullanılır ve log atılır).
async function getEnrichedAddress(
  supabase: SupabaseClient,
  order: any,
): Promise<any | null> {
  // Pickup'ta adres beklenmiyor — sessiz dön
  const isPickup = String(order?.delivery_method ?? "").toLowerCase() === "pickup";

  if (order?.address_id) {
    const { data } = await supabase
      .from("addresses")
      .select("*")
      .eq("id", order.address_id)
      .maybeSingle();
    if (data) return data;
  } else if (!isPickup) {
    // Delivery sipariş ama address_id NULL — mobile fix yapıldıktan sonra
    // BU LOG GÖRÜLMEMELİ. Görülürse kurye fallback heuristic'iyle yanlış
    // adrese gidebilir → push/marketing öncesi MUTLAKA kontrol et.
    console.error("[KRİTİK] orders.address_id NULL", {
      order_id: order?.id,
      user_id: order?.user_id,
      order_code: order?.order_code,
    });
  }

  if (!order?.user_id) return null;

  const { data } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", order.user_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) {
    console.warn("[ADRES FALLBACK]", {
      order_id: order.id,
      user_id: order.user_id,
      picked_id: data.id,
    });
  }
  return data ?? null;
}

// Bütüncül adres string'i: "Mahalle Mh. Sokak No:X Kat:Y D:Z (BinaAdı)"
function composeAddress(addr: any | null, fallbackOrder: any): string {
  if (!addr) return (fallbackOrder?.address ?? "").toString().trim();

  const neighbourhood = (addr.neighbourhood ?? addr.neighborhood ?? "").toString().trim();
  const street = (addr.street ?? "").toString().trim();
  const buildingNo = (addr.building_no ?? "").toString().trim();
  const floor = (addr.floor ?? "").toString().trim();
  const apartmentNo = (addr.apartment_no ?? "").toString().trim();
  const buildingName = (addr.building_name ?? "").toString().trim();

  const parts: string[] = [];
  if (neighbourhood) parts.push(`${neighbourhood} Mh.`);
  if (street) parts.push(street);
  if (buildingNo) parts.push(`No:${buildingNo}`);
  if (floor) parts.push(`Kat:${floor}`);
  if (apartmentNo) parts.push(`D:${apartmentNo}`);
  if (buildingName) parts.push(`(${buildingName})`);

  const composed = parts.join(" ").trim();
  if (composed) return composed;

  // composed boşsa full_address veya order.address fallback
  return (
    (addr.full_address ?? "").toString().trim() ||
    (fallbackOrder?.address ?? "").toString().trim()
  );
}

function pickFirstName(addr: any | null, order: any): string {
  const fromAddr = (addr?.first_name ?? "").toString().trim();
  if (fromAddr) return fromAddr;

  const contactName = (addr?.contact_name ?? "").toString().trim();
  if (contactName) return contactName.split(/\s+/)[0];

  const orderName = (order?.customer_name ?? "Web Müşteri").toString().trim();
  return orderName.split(/\s+/)[0] || "Web";
}

function pickLastName(addr: any | null, order: any): string {
  const fromAddr = (addr?.last_name ?? "").toString().trim();
  if (fromAddr) return fromAddr;

  const contactName = (addr?.contact_name ?? "").toString().trim();
  if (contactName) {
    const parts = contactName.split(/\s+/);
    if (parts.length > 1) return parts.slice(1).join(" ");
  }

  const orderName = (order?.customer_name ?? "").toString().trim();
  const parts = orderName.split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : "-";
}
