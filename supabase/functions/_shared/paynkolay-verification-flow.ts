// Kart Ekle (1 TL doğrulama) — callback ve başlatma ORKESTRASYONU.
// Import'suz/Deno.env'siz: DB, PaynKolay çağrıları ve iade `deps` olarak
// enjekte edilir → Node testlerinde sahte bağımlılıklarla (çift callback, iade
// hatası, kart listelenmedi, yinelenen kart...) birebir çalıştırılır. Gerçek
// bağımlılıklar _shared/paynkolay-card-verification.ts'te (Deno).
//
// SİPARİŞ AKIŞINA HİÇ DOKUNMAZ: orders / refunds tablolarına yazmaz.
// GÜVENLİK: kart no / token / secret log'a ya da sonuca konmaz; hata metinleri
// kart-benzeri rakam dizilerinden arındırılır.

// ── Yerel (import'suz) yardımcılar — paynkolay-verification.ts / -refund.ts ile
//    AYNI kurallar (testlerle eşitliği doğrulanır) ─────────────────────────────
const MAX_REFUND_ATTEMPTS = 72
const INITIATED_TIMEOUT_MINUTES = 15
const DAILY_LIMIT = 3

const redact = (s: unknown, max = 300) => String(s ?? '').replace(/\d{12,}/g, '[redacted]').slice(0, max)

function todayTR(now: Date): string {
  const tr = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${tr.getUTCFullYear()}.${pad(tr.getUTCMonth() + 1)}.${pad(tr.getUTCDate())}`
}

/** Callback TIMESTAMP ("2026-09-18 21:00:00"...) -> yyyy.mm.dd; çözülemezse bugün (TR). */
export function toTrxDate(raw: string, now: Date = new Date()): string {
  const datePart = String(raw ?? '').trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart.replace(/-/g, '.')
  return todayTR(now)
}

async function sha512Base64(parts: string[]): Promise<string> {
  const data = new TextEncoder().encode(parts.join('|'))
  const digest = await (globalThis as any).crypto.subtle.digest('SHA-512', data)
  const bytes = new Uint8Array(digest)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return (globalThis as any).btoa(bin)
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a)
  const bb = new TextEncoder().encode(b)
  const len = Math.max(ab.length, bb.length)
  let diff = ab.length ^ bb.length
  for (let i = 0; i < len; i++) diff |= (i < ab.length ? ab[i] : 0) ^ (i < bb.length ? bb[i] : 0)
  return diff === 0
}

export interface CallbackFields {
  merchantNo: string
  referenceCode: string
  authCode: string
  responseCode: string
  use3D: string
  rnd: string
  installment: string
  authorizationAmount: string
  currencyCode: string
  incomingHash: string
  clientRefCode: string
  responseMessage: string
  txnTimestamp: string
  tranId: string
}

/** Yanıt hash'i (completePaynkolayResult ile AYNI sıra) — sahte callback koruması. */
export async function verifyResponseHash(f: CallbackFields, secretKey: string): Promise<boolean> {
  if (!f.incomingHash) return false
  const expected = await sha512Base64([
    f.merchantNo, f.referenceCode, f.authCode, f.responseCode,
    f.use3D, f.rnd, f.installment, f.authorizationAmount,
    f.currencyCode, secretKey,
  ])
  return constantTimeEqual(expected, f.incomingHash)
}

// ── Tipler ────────────────────────────────────────────────────────────────────
export type VStatus = 'initiated' | 'succeeded' | 'failed' | 'refund_pending' | 'refunded' | 'refund_failed'

export interface VerificationRow {
  id: string
  user_id: string | null
  client_ref_code: string
  amount: number | string
  status: VStatus
  note: string | null
  refund_attempts: number
  created_at: string
}

export interface ListedCardLike { token: string; tranId: string; maskedPan: string }

export interface RefundOutcomeLike {
  ok: boolean
  message: string
  responseCode: string
  fellBack: boolean
  attempts: Array<{ type: string; ok: boolean; httpStatus: number; responseCode: string; networkError: boolean }>
  raw: unknown
}

export interface VerificationDeps<C extends ListedCardLike> {
  now(): Date
  secretKey: string
  getByRef(ref: string): Promise<VerificationRow | null>
  /** initiated VEYA failed (zaman aşımı/önceki hata) -> succeeded TEK SEFERLİK geçiş; alındıysa true.
   *  Hash-doğrulanmış 'ödeme alındı' callback'i para hareketi demektir: satır 'failed' olsa bile iade edilmelidir. */
  claimSucceeded(id: string, patch: Record<string, unknown>): Promise<boolean>
  /** initiated -> failed (yalnız açık kayıt); alındıysa true. */
  markFailed(id: string, note: string): Promise<boolean>
  updateRow(id: string, patch: Record<string, unknown>): Promise<void>
  getCustomerKey(userId: string): Promise<string>
  listCards(customerKey: string): Promise<C[] | null>
  saveCard(userId: string, customerKey: string, entry: C): Promise<void>
  deleteRemoteCard(customerKey: string, entry: C): Promise<boolean>
  refund(req: { referenceCode: string; trxDate: string; amount: string }): Promise<RefundOutcomeLike>
  audit(reason: string, data: Record<string, unknown>, userId: string | null): Promise<void>
}

export type CallbackOutcome =
  | { kind: 'not_found' }
  | { kind: 'hash_invalid' }
  | { kind: 'failed'; note: string }
  | { kind: 'already_processed'; redirectSuccess: boolean }
  | { kind: 'succeeded'; status: VStatus; cardSaved: boolean; note: string | null }

// ── Callback ──────────────────────────────────────────────────────────────────
export async function processVerificationCallback<C extends ListedCardLike>(
  deps: VerificationDeps<C>,
  f: CallbackFields,
): Promise<CallbackOutcome> {
  const row = await deps.getByRef(f.clientRefCode)
  if (!row) return { kind: 'not_found' }

  // Sahte/bozuk callback: satıra DOKUNULMAZ, sadece audit.
  if (!(await verifyResponseHash(f, deps.secretKey))) {
    await deps.audit('hash_mismatch', {
      verificationId: row.id, clientRefCode: f.clientRefCode, responseCode: f.responseCode, hasIncomingHash: !!f.incomingHash,
    }, row.user_id)
    return { kind: 'hash_invalid' }
  }

  // Ödeme alındı mı (para hareketi): RESPONSE_CODE=2 VE AUTH_CODE boş/0/00 değil.
  const authTrim = String(f.authCode ?? '').trim()
  const charged = f.responseCode === '2' && !['', '0', '00'].includes(authTrim)

  if (!charged) {
    const marked = await deps.markFailed(row.id, 'declined')
    if (marked) {
      await deps.audit('declined', {
        verificationId: row.id, clientRefCode: f.clientRefCode, responseCode: f.responseCode,
        message: redact(f.responseMessage, 200),
      }, row.user_id)
    }
    return marked
      ? { kind: 'failed', note: 'declined' }
      : { kind: 'already_processed', redirectSuccess: row.status !== 'failed' && row.status !== 'initiated' }
  }

  const expectedCents = Math.round(Number(row.amount) * 100)
  const incomingCents = Math.round(parseFloat(String(f.authorizationAmount || '0')) * 100)
  const amountMismatch = !incomingCents || incomingCents < expectedCents
  // Para gerçekten çekildi -> ÇEKİLEN tutar iade edilir (mismatch olsa bile).
  const refundCents = incomingCents > 0 ? incomingCents : expectedCents
  const trxDate = toTrxDate(f.txnTimestamp, deps.now())

  // ÇİFT CALLBACK KORUMASI: tek seferlik geçiş — alamayan hiçbir şey yapmaz (iade dahil).
  const claimed = await deps.claimSucceeded(row.id, {
    status: 'succeeded',
    paynkolay_reference_code: f.referenceCode || null,
    paynkolay_trx_date: trxDate,
    tran_id: f.tranId || null,
    note: null,
  })
  if (!claimed) {
    // Başka bir callback zaten aldı (succeeded/refund_*/refunded) — ödeme başarılı.
    return { kind: 'already_processed', redirectSuccess: true }
  }

  // ── Kart işleme (başarısız olsa da iade YİNE yapılır) ────────────────────────
  let cardSaved = false
  let note: string | null = amountMismatch ? 'amount_mismatch' : null
  try {
    if (!row.user_id) {
      note = note ?? 'card_not_listed'
    } else {
      const customerKey = await deps.getCustomerKey(row.user_id)
      const list = customerKey ? await deps.listCards(customerKey) : null
      const match = list && f.tranId ? list.find((e) => e.tranId === f.tranId) ?? null : null
      if (!list || list.length === 0 || !match) {
        note = note ?? 'card_not_listed'
      } else {
        const dup = findDuplicate(list, match)
        if (dup) {
          const deleted = await deps.deleteRemoteCard(customerKey, match)
          note = deleted ? 'duplicate_card' : 'duplicate_card_delete_failed'
        } else {
          await deps.saveCard(row.user_id, customerKey, match)
          cardSaved = true
        }
      }
    }
  } catch (e) {
    note = note ?? 'card_not_listed'
    await deps.audit('card_processing_error', { verificationId: row.id, error: redact((e as Error)?.message ?? e) }, row.user_id)
  }

  // ── İade (tek sefer; başarısızsa sweep tekrar dener) ──────────────────────────
  const refundAmount = (refundCents / 100).toFixed(2)
  let refundOk = false
  let refundError = ''
  let refundResponse: Record<string, unknown> | null = null
  if (!f.referenceCode) {
    refundError = 'referenceCode yok'
  } else {
    try {
      const r = await deps.refund({ referenceCode: f.referenceCode, trxDate, amount: refundAmount })
      refundOk = r.ok
      refundError = r.ok ? '' : (r.message || `iade reddedildi (${r.responseCode || 'kod yok'})`)
      refundResponse = {
        attempts: r.attempts.map((a) => ({ type: a.type, ok: a.ok, httpStatus: a.httpStatus, responseCode: a.responseCode, networkError: a.networkError })),
        fellBack: r.fellBack,
        message: redact(r.message),
      }
    } catch (e) {
      refundError = redact((e as Error)?.message ?? e)
    }
  }

  const attempts = row.refund_attempts + 1
  const nowIso = deps.now().toISOString()
  const status: VStatus = refundOk ? 'refunded' : attempts >= MAX_REFUND_ATTEMPTS ? 'refund_failed' : 'refund_pending'
  await deps.updateRow(row.id, {
    status,
    card_saved: cardSaved,
    note,
    refund_attempts: attempts,
    last_refund_error: refundOk ? null : (redact(refundError) || 'bilinmeyen hata'),
    last_refund_at: nowIso,
    refund_response: refundResponse,
    refunded_at: refundOk ? nowIso : null,
  })

  return { kind: 'succeeded', status, cardSaved, note }
}

/** Yeni kart PaynKolay listesinde başka bir kayıtla aynı maskeli numarayı taşıyorsa (≥10 görünür rakam). */
function findDuplicate<C extends ListedCardLike>(list: C[], newEntry: C): boolean {
  const digits = String(newEntry.maskedPan ?? '').replace(/\D/g, '')
  if (digits.length < 10) return false
  return list.some(
    (e) => e !== newEntry && e.token !== newEntry.token && String(e.maskedPan ?? '').replace(/\D/g, '') === digits,
  )
}

// ── Başlatma planı (saf) ──────────────────────────────────────────────────────
export type StartPlan =
  | { decision: 'proceed'; timeoutIds: string[] }
  | { decision: 'in_progress'; timeoutIds: string[]; activeId: string; retryAfterSeconds: number }
  | { decision: 'limit'; timeoutIds: string[] }

/**
 * @param openRows  kullanıcının 'initiated' kayıtları
 * @param attemptsToday  bugün (TR) oluşturulan TÜM deneme sayısı (başarısızlar dahil)
 * Sıra: zaman aşımı -> açık kayıt varsa in_progress -> günlük limit -> proceed.
 */
export function planStart(
  openRows: Array<{ id: string; created_at: string }>,
  attemptsToday: number,
  now: Date,
): StartPlan {
  const timeoutMs = INITIATED_TIMEOUT_MINUTES * 60 * 1000
  const timeoutIds: string[] = []
  let active: { id: string; ageMs: number } | null = null
  for (const r of openRows) {
    const age = now.getTime() - Date.parse(r.created_at)
    if (Number.isFinite(age) && age >= timeoutMs) timeoutIds.push(r.id)
    else if (!active) active = { id: r.id, ageMs: Number.isFinite(age) ? age : 0 }
  }
  if (active) {
    return { decision: 'in_progress', timeoutIds, activeId: active.id, retryAfterSeconds: Math.max(1, Math.ceil((timeoutMs - active.ageMs) / 1000)) }
  }
  if (attemptsToday >= DAILY_LIMIT) return { decision: 'limit', timeoutIds }
  return { decision: 'proceed', timeoutIds }
}

/** verify_status yanıtı: SADECE bu alanlar (token/kart/referans bilgisi YOK). */
export function toPublicStatus(row: { status: string; card_saved: boolean; note: string | null }) {
  return {
    status: row.status,
    card_saved: !!row.card_saved,
    note: row.note ?? null,
    refunded: row.status === 'refunded',
  }
}
