// Kart Ekle (1 TL doğrulama) — SAF iş kuralları. Import'suz/Deno.env'siz
// (Node testlerinde çalışır). DB/ağ çağrıları çağıran edge function'larda.

export const VERIFICATION_REF_PREFIX = 'KCALVER'
export const VERIFICATION_AMOUNT = 1.0
export const DAILY_VERIFICATION_LIMIT = 3
export const MAX_REFUND_ATTEMPTS = 72 // saatlik retry -> 3 gün
export const INITIATED_TIMEOUT_MINUTES = 15

/** 'KCALVER' + uuid (dashsız). Sipariş regex'i (^KCAL(\d+)T) ile ASLA eşleşmez. */
export function newVerificationRefCode(uuid: string): string {
  return `${VERIFICATION_REF_PREFIX}${String(uuid).replace(/-/g, '')}`
}

export function isVerificationRefCode(code: unknown): boolean {
  return typeof code === 'string' && /^KCALVER[0-9a-fA-F]{8,}$/.test(code)
}

/** TR (GMT+3, DST yok) gününün başlangıcı, UTC ISO olarak — günlük limit penceresi. */
export function trDayStartUtcIso(now: Date = new Date()): string {
  const tr = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const trMidnightAsUtc = Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate(), 0, 0, 0)
  return new Date(trMidnightAsUtc - 3 * 60 * 60 * 1000).toISOString()
}

/** Bugün (TR) yapılan deneme sayısı limiti doldurduysa yeni deneme yapılamaz. */
export function isDailyLimitReached(attemptsToday: number): boolean {
  return attemptsToday >= DAILY_VERIFICATION_LIMIT
}

export function isInitiatedTimedOut(createdAtIso: string, now: Date = new Date()): boolean {
  const created = Date.parse(createdAtIso)
  if (!Number.isFinite(created)) return false
  return now.getTime() - created >= INITIATED_TIMEOUT_MINUTES * 60 * 1000
}

export interface ListedCard {
  token: string
  tranId: string
  maskedPan: string
}

/** Maskeli numaradan görünen rakamları çıkarır ("515787******1234" -> "5157871234"). */
function visibleDigits(maskedPan: string): string {
  return String(maskedPan ?? '').replace(/\D/g, '')
}

/**
 * Yeni kaydedilen kart (callback'teki TranId) PaynKolay listesindeki BAŞKA bir
 * kayıtla aynı maskeli numaraya sahipse yinelenen karttır. Yanlış pozitif riskine
 * karşı (yeni ama meşru bir kartı silmemek için) en az 10 görünür rakam (ilk6 +
 * son4) gerekir; daha azı (ör. yalnız son 4) KARAR VERİLEMEZ -> yinelenen sayılmaz.
 */
export function findDuplicateOfNewCard(
  entries: ListedCard[],
  newTranId: string,
): { isDuplicate: boolean; newEntry: ListedCard | null; existing: ListedCard | null } {
  const newEntry = entries.find((e) => e.tranId && e.tranId === newTranId) ?? null
  if (!newEntry) return { isDuplicate: false, newEntry: null, existing: null }
  const digits = visibleDigits(newEntry.maskedPan)
  if (digits.length < 10) return { isDuplicate: false, newEntry, existing: null }
  const existing = entries.find(
    (e) => e !== newEntry && e.token !== newEntry.token && visibleDigits(e.maskedPan) === digits,
  ) ?? null
  return { isDuplicate: existing !== null, newEntry, existing }
}

export type VerificationStatus =
  | 'initiated' | 'succeeded' | 'failed' | 'refund_pending' | 'refunded' | 'refund_failed'

export interface RefundStateUpdate {
  status: VerificationStatus
  refund_attempts: number
  last_refund_error: string | null
  last_refund_at: string
  refunded_at: string | null
}

/**
 * Bir iade denemesinin sonucundan yeni durum: başarı -> refunded; hata ->
 * deneme sayısı MAX'a ulaştıysa refund_failed (elle çözüm), yoksa refund_pending.
 * `previousAttempts` bu denemeden ÖNCEKİ sayıdır.
 */
export function nextRefundState(
  previousAttempts: number,
  success: boolean,
  errorText: string,
  now: Date = new Date(),
): RefundStateUpdate {
  const attempts = previousAttempts + 1
  const nowIso = now.toISOString()
  if (success) {
    return { status: 'refunded', refund_attempts: attempts, last_refund_error: null, last_refund_at: nowIso, refunded_at: nowIso }
  }
  const cleaned = String(errorText ?? '').replace(/\d{12,}/g, '[redacted]').slice(0, 300)
  return {
    status: attempts >= MAX_REFUND_ATTEMPTS ? 'refund_failed' : 'refund_pending',
    refund_attempts: attempts,
    last_refund_error: cleaned || 'bilinmeyen hata',
    last_refund_at: nowIso,
    refunded_at: null,
  }
}
