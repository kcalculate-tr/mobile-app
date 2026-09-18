// PaynKolay raporlama (PfTransactionReportList) — GRUPLU sorgu.
// Kart Ekle sweep'i onlarca kaydı tek tek sorgulayıp hız sınırına takılmasın diye:
// TEK çağrıyla tarih penceresindeki işlemler çekilir, clientReferenceCode ile
// yerelde eşleştirilir. Toplu (clientReferenceCode='') sorgunun bu hesapta
// GÜVENİLİR çalıştığı doğrulanamadığı için yalnız "güvenilir" sayıldığında
// kullanılır; değilse sınırlı sayıda tekil sorguya (aralıklı) düşülür.
//
// Import'suz/Deno.env'siz — Node testlerinde sahte fetch ile çalışır.
// Loglara kart/secret yazılmaz; sonuç yalnız durum/tutar/referans içerir.

export interface ReportCfg {
  reportSx: string
  secretKey: string
  vposUrl: string // ".../Vpos"
}

export type SaleKind = 'success' | 'error' | 'pending' | 'unknown'

export interface SaleInfo {
  kind: SaleKind
  referenceCode: string
  trxDate: string // yyyy.mm.dd
  amountCents: number
  rawStatus: string
  rawType: string
}

type FetchFn = (url: string, init: { method: string; body: unknown }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>

const pad = (n: number) => String(n).padStart(2, '0')

/** DD.MM.YYYY (UTC tabanlı; pencere marjı saat dilimi farkını yutar). */
export function fmtDDMMYYYY(d: Date): string {
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`
}

/** [now-daysBack, now] penceresi (bitiş gelecekte olamaz). */
export function reportWindow(now: Date, daysBack: number): { startDate: string; endDate: string } {
  return { startDate: fmtDDMMYYYY(new Date(now.getTime() - daysBack * 86400000)), endDate: fmtDDMMYYYY(now) }
}

async function sha512Base64(parts: string[]): Promise<string> {
  const data = new TextEncoder().encode(parts.join('|'))
  const digest = await (globalThis as any).crypto.subtle.digest('SHA-512', data)
  const bytes = new Uint8Array(digest)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return (globalThis as any).btoa(bin)
}

/** Hash: sx | startDate | endDate | clientReferenceCode | referenceCode | secret (mevcut rapor koduyla AYNI). */
export function buildReportHash(cfg: ReportCfg, startDate: string, endDate: string, clientRefCode: string): Promise<string> {
  return sha512Base64([cfg.reportSx, startDate, endDate, clientRefCode, '', cfg.secretKey])
}

function toYmdDots(raw: string): string {
  const s = String(raw ?? '').trim()
  let m = /^(\d{4})[.\-](\d{2})[.\-](\d{2})/.exec(s)
  if (m) return `${m[1]}.${m[2]}.${m[3]}`
  m = /^(\d{2})[.\-](\d{2})[.\-](\d{4})/.exec(s)
  if (m) return `${m[3]}.${m[2]}.${m[1]}`
  return ''
}

const pickStr = (o: any, ...keys: string[]): string => {
  for (const k of keys) {
    const v = o?.[k]
    if (v !== undefined && v !== null && String(v) !== '') return String(v)
  }
  return ''
}

export interface ReportFetch {
  ok: boolean
  httpStatus: number
  list: any[]
}

/** Tek rapor çağrısı. clientRefCode='' => pencerenin TÜM işlemleri (toplu). Ağ/HTTP hatasında ok=false. */
export async function fetchReportList(
  cfg: ReportCfg,
  q: { startDate: string; endDate: string; clientRefCode: string },
  fetchFn: FetchFn = (url, init) => (globalThis as any).fetch(url, init),
): Promise<ReportFetch> {
  if (!cfg.reportSx || !cfg.secretKey || !cfg.vposUrl) return { ok: false, httpStatus: 0, list: [] }
  const hash = await buildReportHash(cfg, q.startDate, q.endDate, q.clientRefCode)
  const form = new (globalThis as any).FormData()
  form.set('sx', cfg.reportSx)
  form.set('startDate', q.startDate)
  form.set('endDate', q.endDate)
  form.set('clientReferenceCode', q.clientRefCode)
  form.set('referenceCode', '')
  form.set('hashDatav2', hash)
  try {
    const res = await fetchFn(`${cfg.vposUrl}/Payment/PfTransactionReportList`, { method: 'POST', body: form })
    const text = await res.text()
    if (!res.ok) return { ok: false, httpStatus: res.status, list: [] }
    let json: any
    try { json = JSON.parse(text) } catch { return { ok: false, httpStatus: res.status, list: [] } }
    const list: any[] = Array.isArray(json?.List) ? json.List : Array.isArray(json?.list) ? json.list : []
    return { ok: true, httpStatus: res.status, list }
  } catch {
    return { ok: false, httpStatus: 0, list: [] }
  }
}

/** Listeden clientRefCode'a ait SATIŞ satırını bulur (yoksa null). */
export function findSale(list: any[], clientRefCode: string): SaleInfo | null {
  const matches = list.filter((t) => String(t?.clientReferenceCode ?? '') === clientRefCode)
  if (matches.length === 0) return null
  const sale = matches.find((t) => String(t?.transactionType ?? '').toUpperCase() === 'SALES') ?? matches[0]
  const status = String(sale?.status ?? '').toUpperCase()
  const amount = parseFloat(pickStr(sale, 'amount', 'Amount', 'AMOUNT', 'transactionAmount', 'TRANSACTION_AMOUNT', 'authorizationAmount', 'AUTHORIZATION_AMOUNT') || '0')
  return {
    kind: status === 'SUCCESS' ? 'success' : status === 'ERROR' ? 'error' : status === 'NEW' ? 'pending' : 'unknown',
    referenceCode: String(sale?.referenceCode ?? ''),
    trxDate: toYmdDots(String(sale?.trxDate ?? '')),
    amountCents: Number.isFinite(amount) ? Math.round(amount * 100) : 0,
    rawStatus: status,
    rawType: String(sale?.transactionType ?? '').toUpperCase(),
  }
}

export interface SalesLookup {
  /** clientRefCode -> satış (bulunamadı = null). Sorgulanmayan/atlanan ref haritada YOK. */
  sales: Map<string, SaleInfo | null>
  /** Sonuç "bulunamadı"yı güvenle söyleyebilir mi (toplu sorgu geçerli ya da tekil sorgu başarılı). */
  trustedNotFound: Set<string>
  batchUsed: boolean
  fallbackCalls: number
  skippedByCap: number
  statusCounts: Record<string, number>
}

/**
 * Önce TEK toplu sorgu. Toplu sorgu şu durumlarda GÜVENİLMEZ sayılır: hata verdi ya da
 * (bizde bu pencerede ödenmiş sipariş varken — expectNonEmpty) boş liste döndü. Güvenilmezse
 * en fazla `maxFallback` tekil sorguya düşülür (aralıklı); geri kalan ref'ler bu turda
 * ATLANIR (durumları DEĞİŞTİRİLMEZ). Güvenilir toplu sonuçta listede olmayan ref = "bulunamadı".
 */
export async function lookupSales(opts: {
  cfg: ReportCfg
  refs: string[]
  now: Date
  daysBack?: number
  expectNonEmpty: boolean
  maxFallback?: number
  fetchFn?: FetchFn
  sleepFn?: (ms: number) => Promise<void>
  fallbackDelayMs?: number
}): Promise<SalesLookup> {
  const { cfg, refs, now } = opts
  const win = reportWindow(now, opts.daysBack ?? 2)
  const out: SalesLookup = {
    sales: new Map(), trustedNotFound: new Set(), batchUsed: false, fallbackCalls: 0, skippedByCap: 0, statusCounts: {},
  }
  if (refs.length === 0) return out
  const count = (s: SaleInfo | null) => {
    if (s) out.statusCounts[`${s.rawType}:${s.rawStatus}`] = (out.statusCounts[`${s.rawType}:${s.rawStatus}`] ?? 0) + 1
  }

  const batch = await fetchReportList(cfg, { ...win, clientRefCode: '' }, opts.fetchFn)
  const batchTrusted = batch.ok && !(batch.list.length === 0 && opts.expectNonEmpty)
  if (batchTrusted) {
    out.batchUsed = true
    for (const ref of refs) {
      const s = findSale(batch.list, ref)
      out.sales.set(ref, s)
      out.trustedNotFound.add(ref) // toplu güvenilir: listede yoksa gerçekten yok
      count(s)
    }
    return out
  }

  const cap = opts.maxFallback ?? 10
  const sleep = opts.sleepFn ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  const delay = opts.fallbackDelayMs ?? 300
  let done = 0
  for (const ref of refs) {
    if (done >= cap) { out.skippedByCap++; continue }
    if (done > 0) await sleep(delay)
    done++
    out.fallbackCalls++
    const one = await fetchReportList(cfg, { ...win, clientRefCode: ref }, opts.fetchFn)
    if (!one.ok) continue // hata: atla (durum değişmez)
    const s = findSale(one.list, ref)
    out.sales.set(ref, s)
    out.trustedNotFound.add(ref) // tekil sorgu başarılı: bulunamadı güvenilir
    count(s)
  }
  return out
}
