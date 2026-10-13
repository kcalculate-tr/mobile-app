import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  fetchPackages,
  TgoCreds,
  TgoPackage,
  TgoLine,
} from '../_shared/trendyolgo.ts'

// ── Trendyol GO sipariş çekici (pg_cron, dakikada bir)
//
// Trendyol webhook göndermiyor; sipariş paketlerini biz çekiyoruz
// (GET .../packages). marketplace_stores tablosundaki AKTİF her satır için
// ayrı çağrı yapılır — her marka ayrı supplierId, her şube ayrı storeId.
//
// API anahtarları Edge Function secret'ında, satırın secret_prefix'i ile:
//   <PREFIX>_API_KEY, <PREFIX>_API_SECRET    (ör. TRENDYOLGO_KCALCULATE_API_KEY)
//   TRENDYOLGO_EXECUTOR_EMAIL                (x-executor-user, hepsi için ortak)
//
// AUTH: verify_jwt=true + role=service_role teyidi (yalnız pg_cron çağırabilir).

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const EXECUTOR_EMAIL = (Deno.env.get('TRENDYOLGO_EXECUTOR_EMAIL') ?? '').trim()

// İlk çalıştırmada (last_polled_at boş) ne kadar geriye bakılacağı.
const ILK_PENCERE_MS = 2 * 60 * 60 * 1000
// Her turda önceki pencereyle çakışma payı — sınırda kalan paket kaçmasın.
const CAKISMA_MS = 3 * 60 * 1000
const MAX_SAYFA = 5

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

interface MagazaSatiri {
  id: string
  brand: string
  supplier_id: string
  store_id: string
  branch_id: string
  secret_prefix: string
  last_polled_at: string | null
}

function credsFor(row: MagazaSatiri): TgoCreds | null {
  const apiKey = (Deno.env.get(`${row.secret_prefix}_API_KEY`) ?? '').trim()
  const apiSecret = (Deno.env.get(`${row.secret_prefix}_API_SECRET`) ?? '').trim()
  if (!apiKey || !apiSecret || !EXECUTOR_EMAIL) return null
  return { supplierId: row.supplier_id, apiKey, apiSecret, executorEmail: EXECUTOR_EMAIL }
}

// ── Trendyol statüsü → bizim sipariş statümüz
// Created   : henüz kabul edilmedi  → mutfakta "Yeni" kutusunda
// Picking   : kabul edildi          → hazırlanıyor
// Invoiced  : hazırlandı            → hazırlanıyor (kuryeye verilmeyi bekliyor)
// Shipped   : yola çıktı
// Delivered : teslim edildi
// Cancelled / UnSupplied : iptal
const STATU_ESLEME: Record<string, string> = {
  Created: 'pending',
  Picking: 'preparing',
  Invoiced: 'preparing',
  Shipped: 'on_way',
  Delivered: 'delivered',
  Cancelled: 'cancelled',
  UnSupplied: 'cancelled',
}

function satirlariCevir(lines: TgoLine[] | undefined) {
  return (lines ?? []).map((line) => {
    const birimler = (line.items ?? []).filter((it) => !it?.isCancelled)
    const adet = Math.max(1, birimler.length)
    const secenekler = (line.modifierProducts ?? [])
      .map((m) => String(m?.name ?? '').trim())
      .filter(Boolean)
    return {
      // DİKKAT: bu id TRENDYOL'un ürün id'si, bizim products.id DEĞİL.
      external_product_id: line.productId ?? null,
      name: String(line.name ?? 'Ürün'),
      quantity: adet,
      unit_price: Number(line.unitSellingPrice ?? line.price ?? 0),
      total_price: Number(line.price ?? 0),
      options: secenekler,
      package_item_ids: birimler.map((it) => String(it.packageItemId)),
    }
  })
}

function adresMetni(pkg: TgoPackage): string {
  const a = (pkg.address ?? {}) as Record<string, string | undefined>
  // Model 1'de gerçek adres address1 içinde; PARSE ETME, tek metin olarak kullan.
  const parcalar = [a.address1, a.address2, a.neighborhood, a.district, a.city]
    .map((p) => String(p ?? '').trim())
    .filter((p) => p && p !== 'TGO Yemek' && p !== 'Trendyol Yemek')
  return parcalar.join(', ')
}

function odemeNotu(pkg: TgoPackage): string {
  const tip = String(pkg.payment?.paymentType ?? '')
  if (tip === 'PAY_WITH_ON_DELIVERY') {
    const alt = String(pkg.payment?.onDelivery?.paymentType ?? '')
    return `KAPIDA ÖDEME${alt ? ` (${alt})` : ''} — kuryenin tahsil etmesi gerekiyor`
  }
  return 'Trendyol üzerinden ödendi'
}

function pakettenSiparis(pkg: TgoPackage, row: MagazaSatiri) {
  const kalemler = satirlariCevir(pkg.lines)
  const musteri = [pkg.customer?.firstName, pkg.customer?.lastName]
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .join(' ')
  const a = (pkg.address ?? {}) as Record<string, string | undefined>
  const toplam = Number(pkg.totalPrice ?? 0)
  const markaEtiketi = row.brand.toLocaleUpperCase('tr-TR')

  return {
    source: 'trendyolgo',
    external_order_id: String(pkg.id),
    external_code: String(pkg.orderNumber ?? pkg.orderCode ?? pkg.id).trim(),
    external_store_id: String(row.store_id),
    external_status: String(pkg.packageStatus),
    external_payload: pkg as unknown as Record<string, unknown>,
    branch_id: row.branch_id,
    status: STATU_ESLEME[pkg.packageStatus] ?? 'pending',
    // Trendyol tahsilatı kendi yapıyor; mutfak panelinin "ödenmemiş sipariş
    // kabul edilemez" kontrolünden geçmesi için paid işaretliyoruz. Kapıda
    // ödemeyse not alanında kuryeye uyarı var.
    payment_status: 'paid',
    payment_method: 'trendyolgo',
    payment_provider: 'trendyolgo',
    user_id: null,
    customer_name: musteri || 'Trendyol Müşterisi',
    customer_email: null,
    phone: String(a.phone ?? '').trim() || null,
    address: adresMetni(pkg) || 'Trendyol GO',
    city: String(a.city ?? '').trim() || null,
    district: String(a.district ?? '').trim() || null,
    neighbourhood: String(a.neighborhood ?? '').trim() || null,
    items: kalemler,
    total_price: toplam,
    total_amount: toplam,
    subtotal_amount: toplam,
    delivery_fee: Number(pkg.totalDeliveryPrice ?? 0),
    delivery_method: pkg.storePickupSelected ? 'pickup' : 'delivery',
    delivery_type: 'immediate',
    delivery_time_type: 'immediate',
    order_code: `TGO-${markaEtiketi}-${String(pkg.orderNumber ?? pkg.orderCode ?? '').trim()}`,
    note: [
      `[TRENDYOL GO · ${markaEtiketi}]`,
      odemeNotu(pkg),
      pkg.storePickupSelected ? 'GEL-AL SİPARİŞ' : '',
      String(a.addressDescription ?? '').trim(),
      a.pinCode ? `PIN: ${a.pinCode}` : '',
    ].filter(Boolean).join(' · '),
    updated_at: new Date().toISOString(),
  }
}

async function magazayiIsle(supabase: SupabaseClient, row: MagazaSatiri) {
  const creds = credsFor(row)
  if (!creds) {
    return { store: row.store_id, brand: row.brand, error: 'secret_eksik', yazilan: 0 }
  }

  const simdi = Date.now()
  const baslangic = row.last_polled_at
    ? new Date(row.last_polled_at).getTime() - CAKISMA_MS
    : simdi - ILK_PENCERE_MS

  let yazilan = 0
  let hata: string | null = null

  for (let sayfa = 0; sayfa < MAX_SAYFA; sayfa++) {
    const sonuc = await fetchPackages(creds, {
      storeId: row.store_id,
      packageStatuses: 'Created,Picking,Invoiced,Shipped,Delivered,Cancelled,UnSupplied',
      packageModificationStartDate: baslangic,
      packageModificationEndDate: simdi,
      page: sayfa,
      size: 50,
    })

    if (!sonuc.ok) {
      hata = `HTTP ${sonuc.status}: ${sonuc.rawText.slice(0, 300)}`
      break
    }

    const paketler = sonuc.body?.content ?? []
    for (const pkg of paketler) {
      const satir = pakettenSiparis(pkg, row)
      // Çakışma anahtarı (source, external_order_id) — poll tekrar ederse
      // sipariş ikinci kez yazılmaz, mevcut kayıt güncellenir.
      const { error } = await supabase
        .from('orders')
        .upsert(satir, { onConflict: 'source,external_order_id' })
      if (error) {
        hata = `upsert(${pkg.id}): ${error.message}`
      } else {
        yazilan++
      }
    }

    const toplamSayfa = sonuc.body?.totalPages ?? 1
    if (sayfa + 1 >= toplamSayfa) break
  }

  await supabase
    .from('marketplace_stores')
    .update({
      // Hata varsa imleci ilerletme: bir sonraki turda aynı pencere tekrar denenir.
      last_polled_at: hata ? row.last_polled_at : new Date(simdi).toISOString(),
      last_poll_error: hata,
    })
    .eq('id', row.id)

  return { store: row.store_id, brand: row.brand, yazilan, error: hata }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (getJwtRole(req.headers.get('Authorization')) !== 'service_role') {
    return jsonResponse({ error: 'Yalnizca service_role cagirabilir' }, 403)
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Supabase ortam degiskenleri eksik' }, 500)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data, error } = await supabase
    .from('marketplace_stores')
    .select('id, brand, supplier_id, store_id, branch_id, secret_prefix, last_polled_at')
    .eq('platform', 'trendyolgo')
    .eq('is_active', true)

  if (error) return jsonResponse({ error: error.message }, 500)

  const satirlar = (data ?? []) as MagazaSatiri[]
  const sonuclar = []
  for (const row of satirlar) {
    try {
      sonuclar.push(await magazayiIsle(supabase, row))
    } catch (e) {
      sonuclar.push({
        store: row.store_id,
        brand: row.brand,
        yazilan: 0,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return jsonResponse({ ok: true, magaza: satirlar.length, sonuclar })
})
