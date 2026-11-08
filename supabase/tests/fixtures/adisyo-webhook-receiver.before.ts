// supabase/functions/adisyo-webhook-receiver/index.ts
//
// Adisyo'dan gelen webhook'ları kabul eder, HMAC doğrular, idempotent şekilde
// kaydeder ve order status'unu Supabase'de günceller.
//
// Adisyo handshake probe:
//   Body sadece "adisyo" string ise → "adisyo" 200 dön (URL doğrulama)
//
// HMAC formülü (Adisyo dokümanı):
//   message = `${webhookEventType}|${eventTimeUtc}|${apiKey}`
//   signature = base64(HMAC_SHA256(key=apiKey, message))
//   Header: X-Adisyo-Signature (case-insensitive aranır)
//
//   apiKey: Adisyo paneli "Webhook Oluştur" butonuyla VERDİĞİ değer
//           (Vault: ADISYO_WEBHOOK_API_KEY)
//
// Event types (camelCase):
//   - order.created      → log only (siparişi biz zaten SaveOrder ile oluşturuyoruz)
//   - order.updated      → GET /Order/{id} çağır, status mapping ile orders.status güncelle
//   - stock.depleted     → log only (Faz 4)
//   - stock.restocked    → log only (Faz 4)
//
// Payload yapısı:
//   {
//     eventId: "...",            // idempotency key
//     webhookEventType: "order.updated",
//     eventTimeUtc: "ISO-8601",
//     restaurantIdentity: "uuid",
//     data: { id: 410200380 }    // sayısal Adisyo order id
//   }
//
// NOT: HMAC doğrulaması başarısız olsa bile event KAYDEDİLİR (audit). İşleme
//      yalnızca signature_valid=true ise yapılır.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHmac } from "node:crypto";

const ADISYO_API_KEY         = Deno.env.get("ADISYO_API_KEY") ?? "";
const ADISYO_API_SECRET      = Deno.env.get("ADISYO_API_SECRET") ?? "";
const ADISYO_API_CONSUMER    = Deno.env.get("ADISYO_API_CONSUMER") ?? "";
const ADISYO_WEBHOOK_API_KEY = Deno.env.get("ADISYO_WEBHOOK_API_KEY") ?? "";
const SUPABASE_URL           = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ADISYO_BASE = "https://ext.adisyo.com/api/External/v2";

// Adisyo GET /Order response → orders.status mapping
//
// Source of truth: numeric `statusId` (string `status` "Teslim Edildi" gibi
// terminal durumlarda null geliyor). statusId yoksa string fallback'ine düşer.
// Bilinmeyen değerlerde null döner ve orders.status DEĞİŞTİRİLMEZ (process_error yazılır).
function mapAdisyoStatus(
  statusId: number | null | undefined,
  statusString: string | null | undefined,
): string | null {
  // 1. statusId öncelikli (kanıtlanmış: 5, 7)
  if (statusId !== null && statusId !== undefined) {
    switch (Number(statusId)) {
      case 5: return "on_way";     // kanıtlandı: status="Teslimatta"
      case 7: return "delivered";  // kanıtlandı: status=null, closedDate dolu
      // Tahminler (henüz production'da gözlenmedi):
      case 1: return "confirmed";  // Sipariş Alındı
      case 3: return "preparing";  // Hazırlandı
      case 8: return "cancelled";  // İptal varyant
      case 9: return "cancelled";  // İptal varyant
    }
  }

  // 2. Fallback: status string (statusId yoksa ya da bilinmeyen sayıysa)
  if (statusString) {
    switch (String(statusString)) {
      case "Ordered":      return "confirmed";
      case "Cooked":       return "preparing";
      case "OnDelivery":
      case "Teslimatta":   return "on_way";
      case "TeslimEdildi": return "delivered";
      case "Iptal":
      case "IptalEdildi":  return "cancelled";
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method !== "POST") return text("method_not_allowed", 405);

  // 1. Raw body (HMAC için string lazım)
  const rawBody = await req.text();

  // 2. Handshake probe (Adisyo URL doğrulama)
  if (rawBody.trim().toLowerCase() === "adisyo") {
    return text("adisyo", 200);
  }

  // 3. JSON parse
  let payload: any;
  try { payload = JSON.parse(rawBody); }
  catch { return text("invalid_json", 400); }

  // 4. Camel-case field extraction
  const eventType  = String(payload.webhookEventType ?? "unknown");
  const eventTime  = String(payload.eventTimeUtc ?? "");
  const eventId    = String(payload.eventId ?? "");
  const restaurantIdentity = payload.restaurantIdentity ?? null;

  const adisyoOrderIdRaw = payload?.data?.id ?? null;
  const adisyoOrderId: number | null =
    adisyoOrderIdRaw != null && adisyoOrderIdRaw !== "" ? Number(adisyoOrderIdRaw) : null;

  if (!eventId) return text("missing_event_id", 400);

  // 5. HMAC doğrulama (sadece base64, key=apiKey)
  const sigHeader = findHeaderCaseInsensitive(req.headers, "x-adisyo-signature") ?? "";
  let signatureValid = false;
  let hmacMessage = "";
  let hmacExpected = "";

  if (ADISYO_WEBHOOK_API_KEY) {
    try {
      hmacMessage = `${eventType}|${eventTime}|${ADISYO_WEBHOOK_API_KEY}`;
      hmacExpected = createHmac("sha256", ADISYO_WEBHOOK_API_KEY)
        .update(hmacMessage)
        .digest("base64");
      signatureValid = timingSafeEqualStr(sigHeader, hmacExpected);
    } catch (e) {
      console.error("HMAC compute failed:", e);
    }
  }

  // Debug log — Adisyo imza formülünü reverse-engineer etmek için
  if (!signatureValid) {
    console.log("[HMAC DEBUG]", {
      receivedSignature: sigHeader,
      rawBody,
      parsedWebhookEventType: eventType,
      parsedEventTimeUtc: eventTime,
      apiKeyFirst8: ADISYO_WEBHOOK_API_KEY.substring(0, 8),
      apiKeyLength: ADISYO_WEBHOOK_API_KEY.length,
      messageString: hmacMessage,
      expectedSignatureBase64: hmacExpected,
      match: false,
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 6. Idempotency (eventId UNIQUE constraint zaten var, ama erken dönmek için)
  const { data: existing } = await supabase
    .from("adisyo_webhook_events")
    .select("id, processed")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    return json({
      ok: true,
      idempotent: true,
      event_id: eventId,
      already_processed: existing.processed,
    });
  }

  // 7. order_id eşleştir (varsa)
  let supabaseOrderId: number | null = null;
  if (adisyoOrderId) {
    const { data: matched } = await supabase
      .from("orders")
      .select("id")
      .eq("adisyo_order_id", adisyoOrderId)
      .maybeSingle();
    supabaseOrderId = matched?.id ?? null;
  }

  // 8. Raw event'i kaydet (signature fail ise debug kolonlarını da doldur)
  const insertRow: Record<string, unknown> = {
    event_id: eventId,
    event_type: eventType,
    adisyo_order_id: adisyoOrderId,
    order_id: supabaseOrderId,
    raw_payload: payload,
    signature_valid: signatureValid,
  };
  if (!signatureValid) {
    insertRow.debug_received_sig   = sigHeader;
    insertRow.debug_expected_sig   = hmacExpected;
    insertRow.debug_message_string = hmacMessage;
  }

  const { data: inserted, error: insErr } = await supabase
    .from("adisyo_webhook_events")
    .insert(insertRow)
    .select()
    .single();

  if (insErr || !inserted) {
    return json({ error: "insert_failed", detail: insErr?.message }, 500);
  }

  // 9. İmza geçersizse process etme (audit için kaydedildi, üstü)
  if (!signatureValid) {
    return json({
      ok: false,
      signature_valid: false,
      event_id: eventId,
      note: "logged_only_signature_invalid",
    }, 401);
  }

  // 10. Event handler dispatch
  let processError: string | null = null;
  let processedFlag = true;

  try {
    switch (eventType) {
      case "order.created":
        // SaveOrder akışımızla zaten 'confirmed' olarak başlatılıyor; bu event audit
        // amaçlı kaydedilir, status değiştirmez.
        break;

      case "order.updated": {
        if (!adisyoOrderId) {
          processError = "missing_adisyo_order_id_in_payload";
          processedFlag = false;
          break;
        }
        if (!supabaseOrderId) {
          // Adisyo bizim sistemimizde bilmediğimiz bir order için event attı.
          // Manuel oluşturulmuş Adisyo siparişi olabilir; status update'i yok sayılır.
          processError = `unknown_adisyo_order_id: ${adisyoOrderId}`;
          processedFlag = false;
          break;
        }

        const orderRes = await fetchAdisyoOrder(supabase, supabaseOrderId, adisyoOrderId);
        if (!orderRes.ok) {
          processError = `get_order_failed: ${orderRes.errorMsg}`;
          processedFlag = false;
          break;
        }

        const remoteStatusId: number | null =
          orderRes.body?.statusId ?? orderRes.body?.StatusId ?? null;
        const remoteStatusStr: string | null =
          orderRes.body?.status ?? orderRes.body?.Status ?? null;
        const mapped = mapAdisyoStatus(remoteStatusId, remoteStatusStr);

        if (!mapped) {
          processError = `unknown_status: statusId=${remoteStatusId ?? "null"}, string=${remoteStatusStr ?? "null"}`;
          processedFlag = false;
          break;
        }

        const { error: updErr } = await supabase
          .from("orders")
          .update({ status: mapped })
          .eq("id", supabaseOrderId);

        if (updErr) {
          processError = `orders_update_failed: ${updErr.message}`;
          processedFlag = false;
        }
        break;
      }

      case "stock.depleted":
      case "stock.restocked":
        // TODO Faz 4: products.is_available toggle.
        // Şimdilik audit-only.
        break;

      default:
        processError = `unknown_event_type: ${eventType}`;
        processedFlag = false;
    }
  } catch (e) {
    processError = String(e);
    processedFlag = false;
  }

  // 11. processed işaretle
  await supabase
    .from("adisyo_webhook_events")
    .update({
      processed: processedFlag,
      processed_at: new Date().toISOString(),
      process_error: processError,
    })
    .eq("id", inserted.id);

  return json({
    ok: processedFlag,
    event_id: eventId,
    event_type: eventType,
    adisyo_order_id: adisyoOrderId,
    order_id: supabaseOrderId,
    restaurant_identity: restaurantIdentity,
    processed: processedFlag,
    process_error: processError,
  });
});

// --- helpers ---

async function fetchAdisyoOrder(
  supabase: SupabaseClient,
  orderId: number,
  adisyoOrderId: number,
): Promise<{ ok: boolean; body?: any; errorMsg: string }> {
  const url = `${ADISYO_BASE}/Order/${adisyoOrderId}`;
  const t0 = Date.now();
  await logApi(supabase, orderId, "GetOrder.request", { adisyoOrderId }, null, null, null, null);

  let respBody: any = null;
  let respStatus: number | null = null;
  let errMsg: string | null = null;

  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": ADISYO_API_KEY,
        "x-api-secret": ADISYO_API_SECRET,
        "x-api-consumer": ADISYO_API_CONSUMER,
      },
    });
    respStatus = resp.status;
    try { respBody = await resp.json(); } catch { respBody = null; }
  } catch (err) {
    errMsg = `network: ${String(err)}`;
  }

  const duration = Date.now() - t0;
  await logApi(supabase, orderId, "GetOrder.response", { adisyoOrderId }, respStatus, respBody, errMsg, duration);

  if (errMsg) return { ok: false, errorMsg: errMsg };

  // Adisyo response zarfı: { status, message, data: {...} } olabilir; veya direkt order objesi.
  const adisyoStatus = respBody?.status;
  if (typeof adisyoStatus === "number" && adisyoStatus !== 100) {
    return {
      ok: false,
      body: respBody,
      errorMsg: `adisyo_status_${adisyoStatus}: ${respBody?.message ?? "unknown"}`,
    };
  }

  // status field'i içeren asıl order objesini bul
  const orderBody = respBody?.data ?? respBody;
  return { ok: true, body: orderBody, errorMsg: "" };
}

async function logApi(
  supabase: SupabaseClient,
  orderId: number | null,
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

function findHeaderCaseInsensitive(headers: Headers, name: string): string | null {
  const target = name.toLowerCase();
  for (const [k, v] of headers.entries()) {
    if (k.toLowerCase() === target) return v;
  }
  return null;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function text(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/plain" } });
}
