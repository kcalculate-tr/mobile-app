import { createClient } from '@supabase/supabase-js'
import {
  allPackageItemIds,
  deliverPackage,
  invoicePackage,
  pickPackage,
  shipPackage,
  TGO_DEFAULT_CANCEL_REASON,
  TgoCreds,
  TgoPackage,
  unsupplyPackage,
} from '../_shared/trendyolgo.ts'

// ── Trendyol GO durum geri yazma
//
// Şube panelinde bir Trendyol siparişinin statüsü değiştiğinde DB tetikleyicisi
// (trg_trendyolgo_push_status) burayı çağırır. Panel aksiyonu → Trendyol çağrısı:
//
//   pending  → preparing   "Kabul Et"              → PUT packages/picked
//   preparing→ on_way      "Hazırlandı→Kuryeye Ver"→ PUT packages/invoiced
//                                                    + PUT .../manual-shipped
//   on_way   → delivered   "Müşteriye Teslim Et"   → PUT .../manual-delivered
//   herhangi → cancelled   "İptal Et"              → PUT packages/unsupplied
//
// manual-shipped / manual-delivered YALNIZ kendi kuryesiyle çalışan satıcılar
// (Model 1) için geçerlidir — Bayraklı Model 1.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const EXECUTOR_EMAIL = (Deno.env.get('TRENDYOLGO_EXECUTOR_EMAIL') ?? '').trim()
const VARSAYILAN_HAZIRLIK_DK = 25

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

function getJwtRole(authHeader: string | null): string | null {
  if (!authHeader) return null
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    return (JSON.parse(atob(base64)) as { role?: string }).role ?? null
  } catch {
    return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (getJwtRole(req.headers.get('Authorization')) !== 'service_role') {
    return jsonResponse({ error: 'Yalnizca service_role cagirabilir' }, 403)
  }

  const govde = await req.json().catch(() => null) as
    | { record?: Record<string, unknown>; orderId?: number | string }
    | null

  const kayit = govde?.record ?? null
  const orderId = kayit?.id ?? govde?.orderId
  if (!orderId) return jsonResponse({ error: 'orderId yok' }, 400)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: siparis, error: siparisHata } = await supabase
    .from('orders')
    .select('id, source, status, external_order_id, external_store_id, external_status, external_payload, branch_id')
    .eq('id', orderId)
    .maybeSingle()

  if (siparisHata) return jsonResponse({ error: siparisHata.message }, 500)
  if (!siparis) return jsonResponse({ error: 'Siparis bulunamadi' }, 404)
  if (siparis.source !== 'trendyolgo' || !siparis.external_order_id) {
    return jsonResponse({ skipped: true, reason: 'trendyol siparisi degil' }, 200)
  }

  const { data: magaza } = await supabase
    .from('marketplace_stores')
    .select('supplier_id, store_id, secret_prefix, brand')
    .eq('platform', 'trendyolgo')
    .eq('store_id', String(siparis.external_store_id))
    .maybeSingle()

  if (!magaza) {
    await isaretle(supabase, orderId, 'failed', `marketplace_stores'ta store_id=${siparis.external_store_id} yok`)
    return jsonResponse({ error: 'magaza eslesmesi yok' }, 404)
  }

  const apiKey = (Deno.env.get(`${magaza.secret_prefix}_API_KEY`) ?? '').trim()
  const apiSecret = (Deno.env.get(`${magaza.secret_prefix}_API_SECRET`) ?? '').trim()
  if (!apiKey || !apiSecret || !EXECUTOR_EMAIL) {
    await isaretle(supabase, orderId, 'failed', `${magaza.secret_prefix} secret'lari eksik`)
    return jsonResponse({ error: 'secret eksik' }, 500)
  }

  const creds: TgoCreds = {
    supplierId: String(magaza.supplier_id),
    apiKey,
    apiSecret,
    executorEmail: EXECUTOR_EMAIL,
  }
  const packageId = String(siparis.external_order_id)
  const durum = String(siparis.status ?? '')

  const adimlar: { ad: string; ok: boolean; status: number; mesaj: string }[] = []
  const calistir = async (ad: string, p: Promise<{ ok: boolean; status: number; rawText: string }>) => {
    const r = await p
    adimlar.push({ ad, ok: r.ok, status: r.status, mesaj: r.rawText.slice(0, 300) })
    return r.ok
  }

  let tumuTamam = true
  try {
    if (durum === 'preparing') {
      tumuTamam = await calistir('picked', pickPackage(creds, packageId, VARSAYILAN_HAZIRLIK_DK))
    } else if (durum === 'on_way') {
      // Trendyol "Shipped"a ancak "Invoiced"dan geçer. Zaten Invoiced ise
      // ikinci invoiced çağrısı hata dönebilir — engel değil, shipped'ı yine dene.
      if (String(siparis.external_status) !== 'Invoiced') {
        await calistir('invoiced', invoicePackage(creds, packageId))
      }
      tumuTamam = await calistir('manual-shipped', shipPackage(creds, packageId))
    } else if (durum === 'delivered') {
      tumuTamam = await calistir('manual-delivered', deliverPackage(creds, packageId))
    } else if (durum === 'cancelled') {
      const pkg = (siparis.external_payload ?? {}) as TgoPackage
      const itemIds = allPackageItemIds(pkg)
      if (itemIds.length === 0) {
        adimlar.push({ ad: 'unsupplied', ok: false, status: 0, mesaj: 'packageItemId bulunamadi' })
        tumuTamam = false
      } else {
        tumuTamam = await calistir(
          'unsupplied',
          unsupplyPackage(creds, packageId, itemIds, TGO_DEFAULT_CANCEL_REASON),
        )
      }
    } else {
      return jsonResponse({ skipped: true, reason: `geri yazilmayan durum: ${durum}` }, 200)
    }
  } catch (e) {
    adimlar.push({
      ad: 'exception',
      ok: false,
      status: 0,
      mesaj: e instanceof Error ? e.message : String(e),
    })
    tumuTamam = false
  }

  const hataMetni = tumuTamam
    ? null
    : adimlar.filter((a) => !a.ok).map((a) => `${a.ad}: ${a.status} ${a.mesaj}`).join(' | ')

  await isaretle(supabase, orderId, tumuTamam ? 'success' : 'failed', hataMetni)

  return jsonResponse({ ok: tumuTamam, durum, adimlar }, tumuTamam ? 200 : 502)
})

async function isaretle(
  supabase: ReturnType<typeof createClient>,
  orderId: number | string,
  sonuc: 'success' | 'failed',
  hata: string | null,
) {
  await supabase
    .from('orders')
    .update({
      external_sync_status: sonuc,
      external_sync_error: hata,
      external_last_attempt_at: new Date().toISOString(),
    })
    .eq('id', orderId)
}
