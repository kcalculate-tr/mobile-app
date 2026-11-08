// supabase/functions/adisyo-reconcile/index.ts
//
// D-S1 — Adisyo gece mutabakatı. pg_cron her gece 04:00 İstanbul'da (01:00 UTC)
// service_role anahtarıyla çağırır (20261109100200_d_s1_adisyo_reconcile_health.sql).
// Elle: POST /functions/v1/adisyo-reconcile  (Authorization: Bearer <service_role>)
//       gövde {} ya da {"dry_config": true} → yalnız etkin ayarı döndürür.
// Ayar: app_settings.adisyo_reconcile (bkz. reconcile.ts DEFAULT_CONFIG).
//
// Kişisel veri: GET /Order yanıtı yalnız toAdisyoOrderRow() beyaz listesinden
// geçer; adisyo_api_log'a yalnız özet (sayılar + sipariş kimlikleri) yazılır.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ADISYO_BASE, fetchAdisyoOrderRaw, type AdisyoCreds } from "../_shared/adisyo-orders.ts";
import { mergeConfig, runReconcile, type QueueEvent, type ReconcileDeps } from "./reconcile.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CREDS: AdisyoCreds = {
  apiKey: Deno.env.get("ADISYO_API_KEY") ?? "",
  apiSecret: Deno.env.get("ADISYO_API_SECRET") ?? "",
  apiConsumer: Deno.env.get("ADISYO_API_CONSUMER") ?? "",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** verify_jwt=true imzayı zaten doğruladı; burada yalnız rolün service_role olduğuna bakılır. */
function isServiceRole(req: Request): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const part = token.split(".")[1];
  if (!part) return false;
  try {
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=")));
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!isServiceRole(req)) return json({ error: "forbidden", hint: "service_role gerekli" }, 403);

  let input: Record<string, unknown> = {};
  try { input = await req.json(); } catch { input = {}; }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const loadConfig = async () => {
    const { data } = await db.from("app_settings").select("value").eq("key", "adisyo_reconcile").maybeSingle();
    return (data?.value ?? null) as Record<string, unknown> | null;
  };
  if (input.dry_config) return json({ config: mergeConfig(await loadConfig()) });

  const deps: ReconcileDeps = {
    now: () => new Date(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    loadConfig,
    async listQueue(limit, maxAttempts, nowIso) {
      const { data, error } = await db
        .from("adisyo_webhook_events")
        .select("id, adisyo_order_id, order_id, ao_attempts")
        .is("ao_synced_at", null)
        .eq("signature_valid", true)
        .not("adisyo_order_id", "is", null)
        .in("event_type", ["order.created", "order.updated"])
        .lt("ao_attempts", maxAttempts)
        .or(`ao_next_retry_at.is.null,ao_next_retry_at.lte.${nowIso}`)
        .order("received_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(`listQueue: ${error.message}`);
      return (data ?? []) as QueueEvent[];
    },
    async listOpenOrderIds(sinceIso, limit) {
      const { data, error } = await db
        .from("adisyo_orders")
        .select("adisyo_order_id")
        .is("closed_at", null)
        .eq("is_cancelled", false)
        .gte("inserted_at", sinceIso)
        .order("inserted_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(`listOpen: ${error.message}`);
      return (data ?? []).map((r: { adisyo_order_id: number }) => Number(r.adisyo_order_id));
    },
    async existingOrderIds(ids) {
      const have = new Set<number>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await db.from("adisyo_orders").select("adisyo_order_id").in("adisyo_order_id", ids.slice(i, i + 200));
        for (const r of data ?? []) have.add(Number((r as { adisyo_order_id: number }).adisyo_order_id));
      }
      return have;
    },
    async fetchOrder(id) {
      const r = await fetchAdisyoOrderRaw(CREDS, id);
      return { ok: r.ok, body: r.body, error: r.error };
    },
    async fetchList(path) {
      try {
        const resp = await fetch(`${ADISYO_BASE}/${path}`, {
          headers: { "x-api-key": CREDS.apiKey, "x-api-secret": CREDS.apiSecret, "x-api-consumer": CREDS.apiConsumer },
        });
        let body: unknown = null;
        try { body = await resp.json(); } catch { body = null; }
        const st = (body as Record<string, unknown> | null)?.status;
        if (!resp.ok) return { ok: false, body: null, error: `http_${resp.status}` };
        if (typeof st === "number" && st !== 100) return { ok: false, body: null, error: `adisyo_status_${st}` };
        return { ok: true, body, error: null };
      } catch (e) {
        return { ok: false, body: null, error: `network: ${String(e).slice(0, 200)}` };
      }
    },
    async upsert(row) {
      const { error } = await db.rpc("adisyo_order_upsert", { p: row });
      return { error: error ? error.message : null };
    },
    async markSynced(events, nowIso) {
      const ids = events.map((e) => e.id);
      await db.from("adisyo_webhook_events")
        .update({ ao_synced_at: nowIso, ao_error: null, ao_next_retry_at: null })
        .in("id", ids);
      // Uygulama dışı olaylar artık işlendi sayılır (eski unknown_adisyo_order_id
      // hatası temizlenir). Uygulama olaylarının processed/process_error'una DOKUNULMAZ.
      const external = events.filter((e) => e.order_id === null).map((e) => e.id);
      if (external.length) {
        await db.from("adisyo_webhook_events")
          .update({ processed: true, processed_at: nowIso, process_error: null })
          .in("id", external);
      }
    },
    async markFailed(events, error, nextRetryIso) {
      for (const e of events) {
        await db.from("adisyo_webhook_events")
          .update({ ao_attempts: e.ao_attempts + 1, ao_error: error.slice(0, 500), ao_next_retry_at: nextRetryIso(e.ao_attempts) })
          .eq("id", e.id);
      }
    },
    async relink() {
      const { data, error } = await db.rpc("adisyo_orders_relink");
      if (error) throw new Error(error.message);
      return Number(data ?? 0);
    },
  };

  const t0 = Date.now();
  try {
    const summary = await runReconcile(deps);
    await db.from("adisyo_api_log").insert({
      order_id: null,
      event_type: "Reconcile.summary",
      request_body: summary,
      response_status: 200,
      duration_ms: Date.now() - t0,
    });
    return json({ ok: true, summary });
  } catch (e) {
    const msg = String(e).slice(0, 500);
    await db.from("adisyo_api_log").insert({
      order_id: null, event_type: "Reconcile.error", error_message: msg, duration_ms: Date.now() - t0,
    });
    return json({ ok: false, error: msg }, 500);
  }
});
