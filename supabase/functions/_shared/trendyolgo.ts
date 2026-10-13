// ── Trendyol GO (Uber Eats Trendyol Go) Yemek entegrasyonu — ortak istemci
//
// Kimlik doğrulama: Basic auth (apiKey:apiSecret). API anahtarı supplierId
// başına TEKTİR, şubeye göre değişmez — şubeyi storeId ayırır.
// Her istekte User-Agent ZORUNLU; yoksa Trendyol 403 döner.
// Limit: aynı uca 10 saniyede en fazla 50 istek.
//
// Dokümantasyon: https://developers.tgoapps.com/docs/authorization

export const TGO_BASE = 'https://api.tgoapis.com/integrator/order/meal/suppliers'
export const TGO_BASE_STAGE = 'https://stageapi.tgoapis.com/integrator/order/meal/suppliers'

export interface TgoCreds {
  supplierId: string
  apiKey: string
  apiSecret: string
  executorEmail: string
}

/** Trendyol paket statüleri (Paket Modelleri dokümanı). */
export type TgoPackageStatus =
  | 'Created'
  | 'Picking'
  | 'Invoiced'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled'
  | 'UnSupplied'

/** Restoran kaynaklı iptal nedenleri — yalnız bunlar unsupplied'da kullanılabilir. */
export const TGO_CANCEL_REASONS: Record<number, string> = {
  621: 'Tedarik problemi',
  622: 'Mağaza kapalı',
  623: 'Mağaza siparişi hazırlayamıyor',
  624: 'Yüksek yoğunluk / Kurye yok',
  626: 'Alan dışı',
  627: 'Sipariş karışıklığı',
}
export const TGO_DEFAULT_CANCEL_REASON = 623

export function tgoHeaders(creds: TgoCreds): HeadersInit {
  const basic = btoa(`${creds.apiKey}:${creds.apiSecret}`)
  return {
    'Authorization': `Basic ${basic}`,
    // Entegratör firma yok, yazılım bize ait → "SatıcıId - SelfIntegration"
    'User-Agent': `${creds.supplierId} - SelfIntegration`,
    'x-agentname': 'SelfIntegration',
    'x-executor-user': creds.executorEmail,
    'Content-Type': 'application/json',
  }
}

export interface TgoResult<T> {
  ok: boolean
  status: number
  body: T | null
  rawText: string
}

async function tgoRequest<T>(
  url: string,
  method: 'GET' | 'PUT',
  creds: TgoCreds,
  body?: unknown,
): Promise<TgoResult<T>> {
  const res = await fetch(url, {
    method,
    headers: tgoHeaders(creds),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const rawText = await res.text()
  let parsed: T | null = null
  try {
    parsed = rawText ? (JSON.parse(rawText) as T) : null
  } catch {
    parsed = null
  }
  return { ok: res.ok, status: res.status, body: parsed, rawText }
}

export interface TgoPackagesPage {
  page: number
  size: number
  totalPages: number
  totalCount: number
  content: TgoPackage[]
}

export interface TgoPackage {
  id: string
  supplierId: number
  storeId: number | string
  orderCode?: string
  orderId?: string
  orderNumber?: string
  storePickupSelected?: boolean | null
  deliveryType?: string
  packageCreationDate?: number
  packageModificationDate?: number
  preparationTime?: number
  totalPrice?: number
  totalDeliveryPrice?: number | null
  appName?: string
  packageStatus: TgoPackageStatus
  customer?: { id?: number; firstName?: string; lastName?: string; email?: string }
  payment?: { paymentType?: string; mealCard?: unknown; onDelivery?: { paymentType?: string } | null }
  address?: Record<string, unknown>
  lines?: TgoLine[]
  [k: string]: unknown
}

export interface TgoLine {
  price?: number
  unitSellingPrice?: number
  name?: string
  productId?: number
  items?: { packageItemId: string; lineItemId?: number; isCancelled?: boolean }[]
  modifierProducts?: { name?: string; price?: number; modifierProducts?: unknown[] }[]
}

/** Sipariş paketlerini çeker. storeId verilince yalnız o şube döner. */
export function fetchPackages(
  creds: TgoCreds,
  params: {
    storeId?: string
    packageStatuses?: string
    packageModificationStartDate?: number
    packageModificationEndDate?: number
    page?: number
    size?: number
  },
): Promise<TgoResult<TgoPackagesPage>> {
  const qs = new URLSearchParams()
  if (params.storeId) qs.set('storeId', params.storeId)
  if (params.packageStatuses) qs.set('packageStatuses', params.packageStatuses)
  if (params.packageModificationStartDate) {
    qs.set('packageModificationStartDate', String(params.packageModificationStartDate))
  }
  if (params.packageModificationEndDate) {
    qs.set('packageModificationEndDate', String(params.packageModificationEndDate))
  }
  qs.set('page', String(params.page ?? 0))
  qs.set('size', String(Math.min(params.size ?? 50, 50)))

  return tgoRequest<TgoPackagesPage>(
    `${TGO_BASE}/${creds.supplierId}/packages?${qs.toString()}`,
    'GET',
    creds,
  )
}

/** Siparişi kabul et → statü Picking. */
export function pickPackage(creds: TgoCreds, packageId: string, preparationTime: number) {
  return tgoRequest(`${TGO_BASE}/${creds.supplierId}/packages/picked`, 'PUT', creds, {
    packageId,
    preparationTime,
  })
}

/** Hazırlık bitti → statü Invoiced. */
export function invoicePackage(creds: TgoCreds, packageId: string) {
  return tgoRequest(`${TGO_BASE}/${creds.supplierId}/packages/invoiced`, 'PUT', creds, {
    packageId,
    actualDate: Date.now(),
  })
}

/** Yola çıktı → statü Shipped. YALNIZ kendi kuryesiyle çalışan satıcılar (Model 1). */
export function shipPackage(creds: TgoCreds, packageId: string) {
  return tgoRequest(
    `${TGO_BASE}/${creds.supplierId}/packages/${packageId}/manual-shipped`,
    'PUT',
    creds,
    { actualDate: Date.now() },
  )
}

/** Teslim edildi → statü Delivered. YALNIZ Model 1. */
export function deliverPackage(creds: TgoCreds, packageId: string) {
  return tgoRequest(
    `${TGO_BASE}/${creds.supplierId}/packages/${packageId}/manual-delivered`,
    'PUT',
    creds,
    { actualDate: Date.now() },
  )
}

/** İptal → statü UnSupplied. itemIdList'in tamamı verilirse full iptal. */
export function unsupplyPackage(
  creds: TgoCreds,
  packageId: string,
  itemIdList: string[],
  reasonId: number,
) {
  return tgoRequest(`${TGO_BASE}/${creds.supplierId}/packages/unsupplied`, 'PUT', creds, {
    packageId,
    itemIdList,
    reasonId,
  })
}

/** Paketteki tüm packageItemId'ler (full iptal için). */
export function allPackageItemIds(pkg: TgoPackage): string[] {
  const ids: string[] = []
  for (const line of pkg.lines ?? []) {
    for (const it of line.items ?? []) {
      if (it?.packageItemId) ids.push(String(it.packageItemId))
    }
  }
  return ids
}
