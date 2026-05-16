// supabase/functions/adisyo-status-forward/index.ts
//
// Branch panel butonları için proxy: KCAL'de status değişikliğini önce Adisyo'ya
// forward eder, sonra (Adisyo başarılı veya değil) Supabase'i de günceller.
//
// Z1 mimarisi: Adisyo down olsa bile branch panel akışı bozulmamalı.
// Adisyo başarısız → orders.adisyo_sync_status='failed' işaretle, AMA Supabase'i
// yine de istenen status'a çevir (kullanıcıya kesintisiz akış).
//
// Body: { orderId: number, action: 'on_delivery' | 'deliver' | 'cancel', courierId?: number }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ADISYO_API_KEY      = Deno.env.get("ADISYO_API_KEY")!;
const ADISYO_API_SECRET   = Deno.env.get("ADISYO_API_SECRET")!;
const ADISYO_API_CONSUMER = Deno.env.get("ADISYO_API_CONSUMER")!;
const ADISYO_DEFAULT_COURIER_ID = parseInt(Deno.env.get("ADISYO_DEFAULT_COURIER_ID") ?? "0");
const ADISYO_PAYMENT_METHOD_ID  = parseInt(Deno.env.get("ADISYO_PAYMENT_METHOD_ID") ?? "61");
const SUPABASE_URL        = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ADISYO_BASE = "https://ext.adisyo.com/api/External/v2";

type Action = "on_delivery" | "deliver" | "cancel";

interface ForwardBody {
  orderId: number;
  action: Action;
  courierId?: number;
  cancelReason?: string;
}

const ACTION_TO_STATUS: Record<Action, string> = {
  on_delivery: "on_way",
  deliver: "delivered",
  cancel: "cancelled",
};

const ACTION_TO_ENDPOINT: Record<Action, string> = {
  on_delivery: "OnDelivery",
  deliver: "Deliver",
  cancel: "Cancel",
};

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: ForwardBody;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const { orderId, action } = body;
  if (!orderId || !action) return json({ error: "missing_fields" }, 400);
  if (!ACTION_TO_STATUS[action]) return json({ error: "invalid_action", action }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // === 1. Sipariş oku
  const { data: dbOrder, error: orderErr } = await supabase
    .from("orders").select("*").eq("id", orderId).single();
  if (orderErr || !dbOrder) {
    return json({ error: "order_not_found", order_id: orderId }, 404);
  }

  // === 2. Randevulu siparişler Adisyo'ya gitmiyor → direkt Supabase update
  if (dbOrder.delivery_type !== "immediate") {
    await supabase.from("orders").update({ status: ACTION_TO_STATUS[action] }).eq("id", orderId);
    return json({ ok: true, skipped_adisyo: "scheduled_delivery", new_status: ACTION_TO_STATUS[action] });
  }

  // === 3. adisyo_order_id yoksa Adisyo'ya gönderemeyiz (sync başarısız olmuş)
  // Z1 fallback: Supabase'i yine de güncelle
  if (!dbOrder.adisyo_order_id) {
    await supabase.from("orders").update({ status: ACTION_TO_STATUS[action] }).eq("id", orderId);
    return json({
      ok: true,
      adisyo_skipped: "no_adisyo_order_id",
      new_status: ACTION_TO_STATUS[action],
      warning: "Adisyo'ya sync olmamış, sadece Supabase güncellendi",
    });
  }

  // === 4. Adisyo payload hazırla
  const adisyoOrderId = dbOrder.adisyo_order_id;
  let endpoint = ACTION_TO_ENDPOINT[action];
  let payload: Record<string, unknown>;

  switch (action) {
    case "on_delivery": {
      const courierId = body.courierId ?? ADISYO_DEFAULT_COURIER_ID;
      if (!courierId) return json({ error: "missing_courier_id" }, 400);
      payload = { orderId: adisyoOrderId, courierId };
      break;
    }
    case "deliver":
      payload = { orderId: adisyoOrderId, paymentType: ADISYO_PAYMENT_METHOD_ID };
      break;
    case "cancel":
      payload = { orderId: adisyoOrderId, cancelReason: body.cancelReason ?? "Branch panel iptal" };
      break;
  }

  // === 5. Adisyo'ya forward + log
  const t0 = Date.now();
  await logEvent(supabase, orderId, `${endpoint}.request`, payload, null, null, null, null);

  let respStatus: number | null = null;
  let respBody: any = null;
  let netErr: string | null = null;

  try {
    const resp = await fetch(`${ADISYO_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "x-api-key": ADISYO_API_KEY,
        "x-api-secret": ADISYO_API_SECRET,
        "x-api-consumer": ADISYO_API_CONSUMER,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    respStatus = resp.status;
    try { respBody = await resp.json(); } catch { respBody = null; }
  } catch (err) {
    netErr = `network: ${String(err)}`;
  }

  const duration = Date.now() - t0;
  await logEvent(supabase, orderId, `${endpoint}.response`, payload, respStatus, respBody, netErr, duration);

  const adisyoStatus = respBody?.status;
  const adisyoOk = !netErr && (adisyoStatus === 100);

  // === 6. Z1 fallback: Supabase'i her durumda güncelle
  const newStatus = ACTION_TO_STATUS[action];
  const updates: Record<string, unknown> = { status: newStatus };

  if (!adisyoOk) {
    const errMsg = netErr ?? `adisyo_status_${adisyoStatus}: ${respBody?.message ?? "unknown"}`;
    updates.adisyo_sync_error = errMsg;
    updates.adisyo_sync_status = "failed";
  }

  await supabase.from("orders").update(updates).eq("id", orderId);

  return json({
    ok: true,
    new_status: newStatus,
    adisyo_ok: adisyoOk,
    adisyo_status: adisyoStatus,
    adisyo_message: respBody?.message,
    fallback: !adisyoOk,
  });
});

async function logEvent(
  supabase: SupabaseClient,
  orderId: number,
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
