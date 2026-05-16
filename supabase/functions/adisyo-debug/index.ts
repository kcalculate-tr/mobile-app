// supabase/functions/adisyo-debug/index.ts
//
// Adisyo API'sini test/keşif için generic proxy.
//
// GET endpoint: { endpoint: "Couriers" | ... }
// POST endpoint: { endpoint: "Accept" | "Prepared" | ..., method: "POST", postBody: {...}, urlSuffix?: "/<orderId>" }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const ADISYO_API_KEY      = Deno.env.get("ADISYO_API_KEY")!;
const ADISYO_API_SECRET   = Deno.env.get("ADISYO_API_SECRET")!;
const ADISYO_API_CONSUMER = Deno.env.get("ADISYO_API_CONSUMER")!;
const ADISYO_BASE = "https://ext.adisyo.com/api/External/v2";

const ALLOWED_GET  = new Set(["Couriers", "PaymentTypes", "Products", "Orders", "OrderTypes"]);
const ALLOWED_POST = new Set(["SaveOrder", "Prepared", "OnDelivery", "Deliver", "Cancel"]);
const ALLOWED_PUT  = new Set(["Order"]);

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const endpoint = body?.endpoint;
  const httpMethod = (body?.method ?? "GET").toUpperCase();
  const urlSuffix = body?.urlSuffix ?? "";

  if (!endpoint) return json({ error: "missing_endpoint" }, 400);

  // rawUrl mode bypasses endpoint allowlist (used for non-trivial paths like /Order/{id}/status)
  if (!body?.rawUrl) {
    const allowed = httpMethod === "GET" ? ALLOWED_GET : httpMethod === "PUT" ? ALLOWED_PUT : ALLOWED_POST;
    if (!allowed.has(endpoint)) {
      return json({ error: "invalid_endpoint", method: httpMethod, allowed: [...allowed] }, 400);
    }
  }

  try {
    // rawUrl mode: bypass base, hit any ext.adisyo.com path
    const rawUrl = body?.rawUrl;
    const url = rawUrl && rawUrl.startsWith("https://ext.adisyo.com/")
      ? rawUrl
      : `${ADISYO_BASE}/${endpoint}${urlSuffix}`;
    const fetchInit: RequestInit = {
      method: httpMethod,
      headers: {
        "x-api-key": ADISYO_API_KEY,
        "x-api-secret": ADISYO_API_SECRET,
        "x-api-consumer": ADISYO_API_CONSUMER,
        "Content-Type": "application/json",
      },
    };
    if (httpMethod === "POST" || httpMethod === "PUT") {
      fetchInit.body = JSON.stringify(body?.postBody ?? {});
    }
    const resp = await fetch(url, fetchInit);
    let respBody: any = null;
    try { respBody = await resp.json(); } catch { respBody = await resp.text().catch(() => null); }
    return json({ url, method: httpMethod, status: resp.status, body: respBody });
  } catch (err) {
    return json({ error: "fetch_failed", detail: String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
