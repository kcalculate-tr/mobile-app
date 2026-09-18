// PaynKolay İptal/İade (CancelRefundPayment) — ORTAK servis.
// paynkolay-refund (Boss panel, sipariş iadesi) VE kart doğrulama iadesi
// (callback + saatlik sweep) AYNI fonksiyonu kullanır; hash/endpoint/başarı
// kuralı TEK yerde.
//
// Bu dosya BİLEREK import'suz ve Deno.env'siz: yapılandırma parametre olarak
// gelir, ağ çağrısı enjekte edilebilir (fetchFn) → Node testlerinde (mock
// fetch ile) birebir çalıştırılır.
//
// type seçimi (DEĞİŞMEDİ): işlem günü == bugün (TR) -> 'cancel', değilse 'refund'.
// YEDEK (YENİ): aynı gün 'cancel' PaynKolay tarafından REDDEDİLİRSE (ör. gün sonu
// kesintisi) aynı işlem için 'refund' denenir. Belirsiz durumda (ağ hatası/
// zaman aşımı — cancel gerçekte gerçekleşmiş olabilir) YEDEK DENENMEZ.
//
// GÜVENLİK: secret / sx / kart / token log'a ya da sonuca KONMAZ. Sonuçtaki
// `raw` sadece PaynKolay'ın iptal/iade yanıtıdır (referenceCode, kod, mesaj).

export type RefundType = 'cancel' | 'refund'

export interface RefundConfig {
  cancelSx: string
  secretKey: string
  vposUrl: string // ".../Vpos"
}

export interface RefundRequest {
  referenceCode: string
  trxDate: string // yyyy.mm.dd
  amount: string // "1.00" (ondalık TL)
}

export interface RefundAttempt {
  type: RefundType
  ok: boolean
  httpStatus: number
  responseCode: string
  message: string
  networkError: boolean
}

export interface RefundResult {
  ok: boolean
  /** Başarılıysa başarılı olan tip; değilse son denenen tip. */
  type: RefundType
  attempts: RefundAttempt[]
  responseCode: string
  message: string
  raw: unknown
  fellBack: boolean
}

export interface RefundOptions {
  now?: Date
  fetchFn?: (url: string, init: { method: string; body: unknown }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>
  allowFallback?: boolean
}

/** TR (GMT+3, DST yok) tarihi yyyy.mm.dd */
export function todayTR(now: Date = new Date()): string {
  const tr = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${tr.getUTCFullYear()}.${pad(tr.getUTCMonth() + 1)}.${pad(tr.getUTCDate())}`
}

export function chooseRefundType(trxDate: string, now: Date = new Date()): RefundType {
  return trxDate === todayTR(now) ? 'cancel' : 'refund'
}

async function sha512Base64(parts: string[]): Promise<string> {
  const data = new TextEncoder().encode(parts.join('|'))
  const digest = await (globalThis as any).crypto.subtle.digest('SHA-512', data)
  const bytes = new Uint8Array(digest)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return (globalThis as any).btoa(bin)
}

/** Hash: sx(cancel) | referenceCode | type | amount | trxDate | secret (eski kodla BİREBİR). */
export function buildRefundHash(cfg: RefundConfig, req: RefundRequest, type: RefundType): Promise<string> {
  return sha512Base64([cfg.cancelSx, req.referenceCode, type, req.amount, req.trxDate, cfg.secretKey])
}

export function isRefundSuccess(httpOk: boolean, responseCode: string): boolean {
  return httpOk && responseCode === '2'
}

/** Yedeğe uygun mu: PaynKolay cevap verdi (ağ hatası DEĞİL) ve başarı değil. */
export function isFallbackEligible(a: RefundAttempt): boolean {
  return !a.networkError && !a.ok
}

/** Hata/log metnini güvenli hale getirir: uzun rakam dizileri (kart no benzeri) maskelenir, kırpılır. */
export function sanitizeErrorText(text: unknown, max = 300): string {
  const s = String(text ?? '').replace(/\d{12,}/g, '[redacted]')
  return s.length > max ? s.slice(0, max) : s
}

async function callOnce(
  cfg: RefundConfig,
  req: RefundRequest,
  type: RefundType,
  fetchFn: NonNullable<RefundOptions['fetchFn']>,
): Promise<{ attempt: RefundAttempt; raw: unknown }> {
  const hash = await buildRefundHash(cfg, req, type)
  const form = new (globalThis as any).FormData()
  form.set('sx', cfg.cancelSx)
  form.set('referenceCode', req.referenceCode)
  form.set('type', type)
  form.set('amount', req.amount)
  form.set('trxDate', req.trxDate)
  form.set('hashDatav2', hash) // küçük v

  let httpOk = false
  let httpStatus = 0
  let text = ''
  try {
    const res = await fetchFn(`${cfg.vposUrl}/v1/CancelRefundPayment`, { method: 'POST', body: form })
    httpOk = res.ok
    httpStatus = res.status
    text = await res.text()
  } catch (e) {
    return {
      attempt: { type, ok: false, httpStatus: 0, responseCode: '', message: sanitizeErrorText((e as Error)?.message ?? e), networkError: true },
      raw: null,
    }
  }

  let json: any
  try { json = JSON.parse(text) } catch { json = { raw: text } }
  const responseCode = String(json?.responseCode ?? json?.RESPONSE_CODE ?? '')
  const message = sanitizeErrorText(
    json?.responseData ?? json?.responseMessage ?? json?.RESPONSE_MESSAGE ?? '',
  )
  return {
    attempt: { type, ok: isRefundSuccess(httpOk, responseCode), httpStatus, responseCode, message, networkError: false },
    raw: json,
  }
}

export async function cancelOrRefundTransaction(
  cfg: RefundConfig,
  req: RefundRequest,
  opts: RefundOptions = {},
): Promise<RefundResult> {
  const now = opts.now ?? new Date()
  const fetchFn = opts.fetchFn ?? ((url, init) => (globalThis as any).fetch(url, init))
  const allowFallback = opts.allowFallback ?? true

  const primary = chooseRefundType(req.trxDate, now)
  const attempts: RefundAttempt[] = []

  const first = await callOnce(cfg, req, primary, fetchFn)
  attempts.push(first.attempt)
  let last = first
  let lastType: RefundType = primary
  let ok = first.attempt.ok
  let fellBack = false

  if (!ok && primary === 'cancel' && allowFallback && isFallbackEligible(first.attempt)) {
    const second = await callOnce(cfg, req, 'refund', fetchFn)
    attempts.push(second.attempt)
    last = second
    lastType = 'refund'
    fellBack = true
    ok = second.attempt.ok
  }

  return {
    ok,
    type: lastType,
    attempts,
    responseCode: last.attempt.responseCode,
    message: last.attempt.message,
    raw: last.raw,
    fellBack,
  }
}
