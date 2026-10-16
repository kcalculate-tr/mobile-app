// supabase/functions/adisyo-debug/index.ts
//
// Adisyo API'sini test/keşif için generic proxy.
//
// GET  endpoint: { endpoint: "Couriers" | "Products" | ... }
// POST endpoint: { endpoint: "SaveOrder" | "Prepared" | ..., method: "POST", postBody: {...}, urlSuffix?: "/<orderId>" }
//
// 16.10.2026 — { branch_id } verilirse o şubenin KENDİ Adisyo hesabı kullanılır
// (branches.adisyo_config). Yalnız GET için: şube kimliğiyle yazma yapılmaz.
// Amacı teşhis: "şubenin Adisyo hesabında gerçekte hangi ürünler var?"

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ADISYO_API_KEY      = Deno.env.get("ADISYO_API_KEY")!;
const ADISYO_API_SECRET   = Deno.env.get("ADISYO_API_SECRET")!;
const ADISYO_API_CONSUMER = Deno.env.get("ADISYO_API_CONSUMER")!;
const SUPABASE_URL        = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADISYO_BASE = "https://ext.adisyo.com/api/External/v2";

const ALLOWED_GET  = new Set(["Couriers", "PaymentTypes", "Products", "Orders", "OrderTypes"]);
const ALLOWED_POST = new Set(["SaveOrder", "Prepared", "OnDelivery", "Deliver", "Cancel"]);
const ALLOWED_PUT  = new Set(["Order"]);

interface Creds { apiKey: string; apiSecret: string; apiConsumer: string }

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

  // Kimlik: varsayılan merkez (env). branch_id verilirse şubenin kendi hesabı.
  let creds: Creds = {
    apiKey: ADISYO_API_KEY,
    apiSecret: ADISYO_API_SECRET,
    apiConsumer: ADISYO_API_CONSUMER,
  };
  let kaynak = "merkez (env)";

  if (body?.branch_id) {
    if (httpMethod !== "GET") {
      return json({ error: "branch_creds_read_only", hint: "branch_id yalnız GET ile kullanılabilir" }, 400);
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: sube } = await supabase
      .from("branches")
      .select("id, name, adisyo_config")
      .eq("id", body.branch_id)
      .maybeSingle();
    if (!sube) return json({ error: "branch_not_found", branch_id: body.branch_id }, 404);
    const c = (sube.adisyo_config ?? {}) as Partial<Creds>;
    if (!c.apiKey || !c.apiSecret || !c.apiConsumer) {
      return json({ error: "branch_adisyo_config_missing", branch: sube.name }, 400);
    }
    creds = { apiKey: c.apiKey, apiSecret: c.apiSecret, apiConsumer: c.apiConsumer };
    kaynak = String(sube.name);
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
        "x-api-key": creds.apiKey,
        "x-api-secret": creds.apiSecret,
        "x-api-consumer": creds.apiConsumer,
        "Content-Type": "application/json",
      },
    };
    if (httpMethod === "POST" || httpMethod === "PUT") {
      fetchInit.body = JSON.stringify(body?.postBody ?? {});
    }
    const resp = await fetch(url, fetchInit);
    let respBody: any = null;
    try { respBody = await resp.json(); } catch { respBody = await resp.text().catch(() => null); }

    // Products için kısa özet: 141 ürünü ham JSON olarak dökmek okunmaz oluyor.
    if (endpoint === "Products" && httpMethod === "GET" && respBody?.data) {
      const satirlar: Array<Record<string, unknown>> = [];
      for (const cat of respBody.data ?? []) {
        for (const p of cat.products ?? []) {
          const u = (p.productUnits ?? []).find((x: any) => x.isDefault) ?? (p.productUnits ?? [])[0];
          satirlar.push({
            kategori: cat.categoryName,
            ad: p.productName,
            kod: p.productCode ?? null,
            unit_id: u?.productUnitId ?? null,
          });
        }
      }
      return json({
        kaynak,
        status: resp.status,
        toplam: satirlar.length,
        kodu_olan: satirlar.filter((r) => r.kod).length,
        urunler: satirlar,
      });
    }

    return json({ kaynak, url, method: httpMethod, status: resp.status, body: respBody });
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
