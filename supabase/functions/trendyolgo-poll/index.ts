import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  fetchPackages,
  pickPackage,
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
  auto_accept: boolean
  preparation_time_min: number
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

// Yerel durumun "ilerilik" sırası. Poll, bizim durumumuzu GERİ ALMAZ:
// panelde "Kuryeye Ver" denmiş bir siparişi, Trendyol henüz Invoiced
// gösteriyor diye preparing'e düşürmek siparişi mutfakta kaybettirir.
const DURUM_RUTBESI: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  preparing: 2,
  on_way: 3,
  delivered: 4,
}

function durumIlerledi(uzak: string, yerel: string | null): boolean {
  if (uzak === 'cancelled') return true           // iptal her zaman geçerli
  if (!yerel) return true
  if (yerel === 'cancelled') return false         // iptal edilmişi geri açma
  return (DURUM_RUTBESI[uzak] ?? 0) > (DURUM_RUTBESI[yerel] ?? 0)
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
    return { store: row.store_id, brand: row.brand, error: 'secret_eksik', yeni: 0, guncellenen: 0, kabul: 0 }
  }

  const simdi = Date.now()
  const baslangic = row.last_polled_at
    ? new Date(row.last_polled_at).getTime() - CAKISMA_MS
    : simdi - ILK_PENCERE_MS

  let yeni = 0
  let guncellenen = 0
  let kabul = 0
  let hata: string | null = null
  const paketler: TgoPackage[] = []

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

    paketler.push(...(sonuc.body?.content ?? []))
    const toplamSayfa = sonuc.body?.totalPages ?? 1
    if (sayfa + 1 >= toplamSayfa) break
  }

  if (paketler.length > 0) {
    // Mevcut kayıtları tek sorguda al — durumu geri almamak için gerekli.
    const idler = paketler.map((p) => String(p.id))
    const { data: mevcutlar } = await supabase
      .from('orders')
      .select('id, external_order_id, status')
      .eq('source', 'trendyolgo')
      .in('external_order_id', idler)

    const mevcutHarita = new Map<string, { id: number; status: string | null }>()
    for (const m of (mevcutlar ?? []) as { id: number; external_order_id: string; status: string | null }[]) {
      mevcutHarita.set(String(m.external_order_id), { id: m.id, status: m.status })
    }

    for (const pkg of paketler) {
      const paketId = String(pkg.id)
      const satir = pakettenSiparis(pkg, row)
      const mevcut = mevcutHarita.get(paketId)

      if (!mevcut) {
        // YENİ SİPARİŞ
        const { error } = await supabase.from('orders').insert(satir)
        if (error) {
          // Yarış durumu: aynı anda başka bir tur eklemiş olabilir — tekil
          // indeks yakalar, bu bir hata değil.
          if (!String(error.message).includes('duplicate key')) {
            hata = `insert(${paketId}): ${error.message}`
          }
          continue
        }
        yeni++

        // OTOMATİK KABUL — sipariş geldiği anda Trendyol'a picked gönder.
        if (row.auto_accept && pkg.packageStatus === 'Created') {
          const kabulSonuc = await pickPackage(creds, paketId, row.preparation_time_min)
          if (kabulSonuc.ok) {
            kabul++
            await supabase.from('orders').update({
              status: 'preparing',
              external_status: 'Picking',
              external_sync_status: 'success',
              external_sync_error: null,
              external_last_attempt_at: new Date().toISOString(),
            }).eq('source', 'trendyolgo').eq('external_order_id', paketId)
          } else {
            await supabase.from('orders').update({
              external_sync_status: 'failed',
              external_sync_error:
                `otomatik kabul basarisiz — HTTP ${kabulSonuc.status}: ${kabulSonuc.rawText.slice(0, 250)}`,
              external_last_attempt_at: new Date().toISOString(),
            }).eq('source', 'trendyolgo').eq('external_order_id', paketId)
          }
        }
        continue
      }

      // MEVCUT SİPARİŞ — durumu YALNIZ ileri taşı.
      const guncelleme: Record<string, unknown> = {
        external_status: satir.external_status,
        external_payload: satir.external_payload,
        total_price: satir.total_price,
        total_amount: satir.total_amount,
        updated_at: satir.updated_at,
      }
      if (durumIlerledi(String(satir.status), mevcut.status)) {
        guncelleme.status = satir.status
      }

      const { error } = await supabase.from('orders').update(guncelleme).eq('id', mevcut.id)
      if (error) {
        hata = `update(${paketId}): ${error.message}`
      } else {
        guncellenen++
      }
    }
  }

  await supabase
    .from('marketplace_stores')
    .update({
      // Hata varsa imleci ilerletme: bir sonraki turda aynı pencere tekrar denenir.
      last_polled_at: hata ? row.last_polled_at : new Date(simdi).toISOString(),
      last_poll_error: hata,
    })
    .eq('id', row.id)

  return { store: row.store_id, brand: row.brand, yeni, guncellenen, kabul, error: hata }
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
    .select('id, brand, supplier_id, store_id, branch_id, secret_prefix, last_polled_at, auto_accept, preparation_time_min')
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
        yeni: 0,
        guncellenen: 0,
        kabul: 0,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return jsonResponse({ ok: true, magaza: satirlar.length, sonuclar })
})
