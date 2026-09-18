// PaynKolay "Kart Saklama" (CardStorage) servisleri — LİSTE + SİLME.
// Import'suz / Deno.env'siz: yapılandırma parametre, ağ çağrısı enjekte edilebilir
// (fetchFn) → Node testlerinde (mock fetch) çalıştırılır.
//
// ══ PAYNKOLAY YANIT ZARFLARI SERVİSE GÖRE DEĞİŞİR — BAŞARI KURALLARI (servis başına) ══
// Bir servisin başarı kuralını BAŞKA servisten kopyalama: 2026-09-18'de kart silme,
// CardStorageCardList'in `ProcReturnCode === "00"` kuralı kopyalandığı için gerçekte
// silinen kartı "silinemedi" sanıp yerel kaydı yetim bıraktı.
//
//  • CardStorageCardList  (/Vpos/Payment/CardStorageCardList)
//      Zarf : { ProcReturnCode, ErrMsg, Data:{ cards:{ Card:{ CardFileds:{ Detail:[…] }}}} }
//      Başarı: ProcReturnCode === "00" (liste Data'da).
//      Kart yok: ProcReturnCode "02" + ErrMsg "Gecerli Kart Yok" = KESİN boş liste
//               (hata DEĞİL; 2026-09-18 canlıda silme sonrası gözlendi).
//      Diğer her şey (HTTP hata, JSON değil, başka kod) = BELİRSİZ → hiçbir şey silinmez.
//  • CardStorageCardDelete (/Vpos/Payment/CardStorageCardDelete)
//      Zarf : { TRAN_ID, RESPONSE_CODE, ERROR_CODE, RESPONSE_DATA, ERROR_MESSAGE,
//               sessionId, CORE_TRX_ID_RESERVED, TimeStamp }  — ProcReturnCode/ErrMsg YOK.
//      Başarı değeri (RESPONSE_CODE) DOKÜMANDA YAZMIYOR ve canlıda doğrulanmadı →
//      yanıta GÜVENİLMEZ; sonuç her zaman CardStorageCardList ile DOĞRULANIR
//      ("liste geldi ve token yok" ⇒ silinmiş). Kodlar teşhis için (token'sız) loglanır.
//      İstek alanları: sx, customerKey, token, hashDatav2 (+ tranId — canlıda sorun çıkarmadı).
//      Hash: sx|customerKey|tranId|token|secret ("||" — tranId boşken yer korunur).
//  • v1/CancelRefundPayment (paynkolay-refund.ts)
//      Zarf : { responseCode, responseData }. Başarı: HTTP ok && responseCode === "2".
//  • PfTransactionReportList (paynkolay-report.ts)
//      Zarf : { List:[{ clientReferenceCode, transactionType, status, referenceCode, trxDate, … }] }
//      status SUCCESS | ERROR | NEW. Toplu sorgunun boş dönmesi tek başına "yok" demek DEĞİL.
//  • Hosted ödeme dönüşü / callback (completePaynkolayResult, paynkolay-cards.ts)
//      Alanlar: RESPONSE_CODE, AUTH_CODE, … + hash. Başarı: RESPONSE_CODE === "2" &&
//      AUTH_CODE ∉ {"", "0", "00"} && hash geçerli && tutar ≥ sipariş tutarı.
//  • v1/Payment (saklı kartla ödeme, API) — ham JSON döner; ayrıştırma paynkolay-3d.ts.

export interface CardStorageEntry {
  token: string
  tranId: string
  maskedPan: string
  last4: string
  brand: string
  bank: string
  alias: string
}

export interface StorageCfg {
  vposUrl: string
  sx: string
  secretKey: string
}

export type FetchFn = (
  url: string,
  init: { method: string; body: unknown },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>

const defaultFetch: FetchFn = (url, init) => (globalThis as any).fetch(url, init)

async function sha512Base64(parts: string[]): Promise<string> {
  const data = new TextEncoder().encode(parts.join('|'))
  const digest = await (globalThis as any).crypto.subtle.digest('SHA-512', data)
  const bytes = new Uint8Array(digest)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return (globalThis as any).btoa(bin)
}

const pickStr = (o: any, ...keys: string[]): string => {
  for (const k of keys) {
    const v = o?.[k]
    if (v !== undefined && v !== null && String(v) !== '') return String(v)
  }
  return ''
}

/** Hata/log metnini güvenli hale getirir: token ve uzun rakam dizileri (kart no benzeri) maskelenir. */
export function sanitizeText(text: unknown, token = '', max = 200): string {
  let s = String(text ?? '')
  if (token) s = s.split(token).join('[token]')
  s = s.replace(/\d{12,}/g, '[redacted]')
  return s.length > max ? s.slice(0, max) : s
}

// ── Liste ─────────────────────────────────────────────────────────────────────
export function isCardStorageListSuccess(json: any): boolean {
  return String(json?.ProcReturnCode ?? '') === '00'
}

const normalizeTr = (s: string) =>
  s.toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').trim()

/** "02 / Gecerli Kart Yok": kart yok = KESİN boş liste (hata değil). */
export function isCardStorageListEmpty(json: any): boolean {
  return String(json?.ProcReturnCode ?? '') === '02' && normalizeTr(String(json?.ErrMsg ?? '')).includes('gecerli kart yok')
}

export function parseCardStorageList(json: any): CardStorageEntry[] {
  const detail = json?.Data?.cards?.Card?.CardFileds?.Detail
  const rows: any[] = Array.isArray(detail) ? detail : detail ? [detail] : []
  return rows
    .map((row: any) => {
      const maskedPan = pickStr(row, 'Maskedpan', 'maskedPan', 'MASKEDPAN')
      return {
        token: pickStr(row, 'Token', 'token'),
        tranId: pickStr(row, 'TranId', 'tranId'),
        maskedPan,
        last4: maskedPan.replace(/\D/g, '').slice(-4),
        brand: pickStr(row, 'CARDBRAND', 'cardBrand'),
        bank: pickStr(row, 'CARDISSUER', 'bankName'),
        alias: pickStr(row, 'CARD_ALIACE', 'cardAlias'),
      }
    })
    .filter((e) => e.tranId || e.token)
}

export type ListOutcome =
  | { kind: 'listed'; entries: CardStorageEntry[]; httpStatus: number; procReturnCode: string; errMsg: string }
  | { kind: 'empty'; httpStatus: number; procReturnCode: string; errMsg: string } // "Gecerli Kart Yok"
  | { kind: 'error'; httpStatus: number; procReturnCode: string; errMsg: string } // BELİRSİZ

export async function fetchListOutcome(
  cfg: StorageCfg,
  customerKey: string,
  fetchFn: FetchFn = defaultFetch,
): Promise<ListOutcome> {
  const err = (httpStatus: number, procReturnCode: string, errMsg: string): ListOutcome => ({ kind: 'error', httpStatus, procReturnCode, errMsg })
  if (!cfg.vposUrl || !cfg.sx || !cfg.secretKey || !customerKey) {
    return err(0, '', 'Yapilandirma eksik (vposUrl/sx/secretKey/customerKey)')
  }
  try {
    const form = new (globalThis as any).FormData()
    form.set('sx', cfg.sx)
    form.set('customerKey', customerKey)
    form.set('hashDatav2', await sha512Base64([cfg.sx, customerKey, cfg.secretKey]))
    const res = await fetchFn(`${cfg.vposUrl}/Payment/CardStorageCardList`, { method: 'POST', body: form })
    const raw = await res.text()
    if (!res.ok) return err(res.status, '', `HTTP ${res.status}`)
    let json: any
    try { json = JSON.parse(raw) } catch { return err(res.status, '', 'Yanit JSON degil') }
    const procReturnCode = String(json?.ProcReturnCode ?? '')
    const errMsg = String(json?.ErrMsg ?? '')
    if (isCardStorageListSuccess(json)) {
      return { kind: 'listed', entries: parseCardStorageList(json), httpStatus: res.status, procReturnCode, errMsg }
    }
    if (isCardStorageListEmpty(json)) return { kind: 'empty', httpStatus: res.status, procReturnCode, errMsg }
    return err(res.status, procReturnCode, errMsg)
  } catch (e) {
    return err(0, '', String((e as Error)?.message ?? e))
  }
}

// ── Silme (yanıta değil, LİSTEYE göre doğrulanır) ─────────────────────────────
export type DeleteReason =
  | 'skipped'            // yapılandırma/token yok: yapılacak bir şey yok
  | 'deleted'            // liste geldi, token yok (silindi ya da zaten yoktu)
  | 'still_listed'       // liste geldi, token HÂLÂ listede → silinemedi
  | 'verify_unavailable' // liste alınamadı → sonuç BİLİNMİYOR (yerel kayıt silinmez)

export interface DeleteResult {
  ok: boolean
  reason: DeleteReason
  error?: string
  /** Silme çağrısının zarf kodları (token'sız; teşhis). */
  responseCode?: string
  errorCode?: string
}

export async function deleteCardVerified(
  params: StorageCfg & { customerKey: string; tranId: string; token: string },
  fetchFn: FetchFn = defaultFetch,
): Promise<DeleteResult> {
  const { vposUrl, sx, secretKey, customerKey, tranId, token } = params
  if (!sx || !secretKey || !vposUrl || !token) return { ok: true, reason: 'skipped' }
  if (!customerKey) return { ok: false, reason: 'verify_unavailable', error: 'customerKey yok' }

  // 1) Silme isteği. Yanıt BAŞARI KANITI SAYILMAZ (bkz. dosya başı); yalnız teşhis için okunur.
  let responseCode = ''
  let errorCode = ''
  let httpStatus = 0
  let errorMessage = ''
  try {
    const form = new (globalThis as any).FormData()
    form.set('sx', sx)
    form.set('customerKey', customerKey)
    form.set('tranId', tranId)
    form.set('token', token)
    form.set('hashDatav2', await sha512Base64([sx, customerKey, tranId, token, secretKey]))
    const res = await fetchFn(`${vposUrl}/Payment/CardStorageCardDelete`, { method: 'POST', body: form })
    httpStatus = res.status
    const raw = await res.text()
    let json: any = null
    try { json = JSON.parse(raw) } catch { json = null }
    if (json) {
      responseCode = sanitizeText(json?.RESPONSE_CODE ?? json?.ProcReturnCode ?? '', token, 40)
      errorCode = sanitizeText(json?.ERROR_CODE ?? '', token, 40)
      errorMessage = sanitizeText(json?.ERROR_MESSAGE ?? json?.ErrMsg ?? json?.RESPONSE_DATA ?? '', token)
    } else {
      errorMessage = 'Yanit JSON degil'
    }
  } catch (e) {
    errorMessage = sanitizeText((e as Error)?.message ?? e, token)
  }

  // 2) DOĞRULAMA: listeye bak.
  const list = await fetchListOutcome({ vposUrl, sx, secretKey }, customerKey, fetchFn)
  let reason: DeleteReason
  if (list.kind === 'error') reason = 'verify_unavailable'
  else if (list.kind === 'empty') reason = 'deleted'
  else reason = list.entries.some((e) => e.token === token) ? 'still_listed' : 'deleted'

  // GÜVENLİ LOG: yalnız kodlar/durum — token/kart/customerKey YOK.
  console.log('[paynkolay-card-storage] delete', {
    httpStatus, responseCode, errorCode, errorMessage,
    verify: list.kind, verifyProcReturnCode: list.procReturnCode, verifyErrMsg: sanitizeText(list.errMsg, token, 80), result: reason,
  })

  return {
    ok: reason === 'deleted',
    reason,
    error: reason === 'deleted' ? undefined : reason === 'still_listed' ? (errorMessage || 'Kart hâlâ listede') : 'Liste doğrulaması alınamadı',
    responseCode,
    errorCode,
  }
}

// ── Sync temizliği: PaynKolay listesinde olmayan yerel kartlar (yetim) ─────────
export interface LocalCardForReconcile {
  id: string
  /** user_card_secrets.card_token — yoksa (null) kart doğrulanamaz, DOKUNULMAZ. */
  token: string | null
  customerKey: string | null
  createdAt: string
}

/** Yarış koruması: liste çekiminden ÖNCE oluşmuş (margin kadar eski) kartlar değerlendirilir. */
export const RECONCILE_MARGIN_MS = 2 * 60 * 1000

/**
 * Yetim yerel kartları seçer. YALNIZ liste kesin geldiyse (listed/empty) çağrılmalıdır —
 * `list.kind === 'error'` iken HİÇBİR ŞEY silinmez (null döner).
 */
export function planOrphans(
  list: ListOutcome,
  locals: LocalCardForReconcile[],
  customerKey: string,
  fetchStartedAtMs: number,
): string[] | null {
  if (list.kind === 'error') return null
  // Liste dolu ama hiçbir kayıtta token yoksa (beklenmeyen biçim) karşılaştırma GÜVENSİZ: silme.
  if (list.kind === 'listed' && list.entries.length > 0 && !list.entries.some((e) => e.token)) return null
  const remote = new Set(list.kind === 'listed' ? list.entries.map((e) => e.token).filter(Boolean) : [])
  return locals
    .filter((c) => {
      if (!c.token) return false                                   // doğrulanamaz
      if (c.customerKey !== customerKey) return false              // başka müşteri anahtarı: listeye ait değil
      const created = Date.parse(c.createdAt)
      if (!Number.isFinite(created) || created > fetchStartedAtMs - RECONCILE_MARGIN_MS) return false // yeni kart (yarış)
      return !remote.has(c.token)
    })
    .map((c) => c.id)
}
