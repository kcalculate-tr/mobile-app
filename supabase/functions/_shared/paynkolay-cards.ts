import { SupabaseClient } from '@supabase/supabase-js'

// ── Paynkolay "Saklı Kart" ortak mantığı ────────────────────────────────────
// paynkolay-callback (hosted donus) VE paynkolay-cards (sync/pay) TARAFINDAN
// PAYLASILIR. Basari kurali / kart-kaydetme / order tamamlama TEK YERDE —
// biri degisince ikisi de degisir (2026-09-16 gercek test geri bildirimiyle
// yazildi: CardStorageCardList yaniti + hosted donus alan adlari canli testte
// dogrulandi).

const CARD_SAVE_ENABLED =
  (Deno.env.get('PAYNKOLAY_CARD_SAVE') ?? 'false').toLowerCase() === 'true'

// ── Hash: parts.join('|') -> UTF-8 -> SHA-512 (binary) -> base64.
export async function generatePaynkolayHash(parts: string[]): Promise<string> {
  const hashString = parts.join('|')
  const data = new TextEncoder().encode(hashString)
  const hashBuffer = await crypto.subtle.digest('SHA-512', data)
  const bytes = new Uint8Array(hashBuffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

// SABIT-ZAMAN string karsilastirma (timing attack korumasi).
export function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a)
  const bBytes = new TextEncoder().encode(b)
  const len = Math.max(aBytes.length, bBytes.length)
  let diff = aBytes.length ^ bBytes.length
  for (let i = 0; i < len; i++) {
    const x = i < aBytes.length ? aBytes[i] : 0
    const y = i < bBytes.length ? bBytes[i] : 0
    diff |= x ^ y
  }
  return diff === 0
}

// Birden fazla olasi alan adindan ilk dolu degeri al (UPPER + camelCase tolerans).
export function pick(data: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = data?.[k]
    if (v !== undefined && v !== null && String(v) !== '') return String(v)
  }
  return ''
}

// admin_allowlist teyidi (service-role; user_id, fallback email) — query/refund ile AYNI desen.
export async function isAllowlistedAdmin(
  admin: SupabaseClient,
  userId: string,
  email?: string | null,
): Promise<boolean> {
  const byId = await admin.from('admin_allowlist').select('id').eq('user_id', userId).maybeSingle()
  if (byId.data) return true
  if (email) {
    const byEmail = await admin.from('admin_allowlist').select('id').eq('email', email).maybeSingle()
    if (byEmail.data) return true
  }
  return false
}

// ── CardStorageCardList yaniti (2026-09-16 canli testte GERCEK dogrulandi):
//   { ProcReturnCode: "00", Data: { cards: { Card: { CardFileds: { Detail: [
//     { Token, TranId, Maskedpan, CARDISSUER, CARDTYPE, CARDBRAND, CARD_ALIACE }
//   ] } } } } }
// "CardFileds"/"CARD_ALIACE" upstream'in KENDI yazim hatasi — bizim tarafta duzeltilmez.
// Detail tek kayitta da DIZI gelir; nesne gelirse de calisir (defensive).
export interface CardStorageEntry {
  token: string
  tranId: string
  maskedPan: string
  last4: string
  brand: string
  bank: string
  alias: string
}

export function isCardStorageListSuccess(json: any): boolean {
  return String(json?.ProcReturnCode ?? '') === '00'
}

export function parseCardStorageList(json: any): CardStorageEntry[] {
  const detail = json?.Data?.cards?.Card?.CardFileds?.Detail
  const rows: any[] = Array.isArray(detail) ? detail : detail ? [detail] : []
  return rows
    .map((row: any) => {
      const maskedPan = pick(row, 'Maskedpan', 'maskedPan', 'MASKEDPAN')
      return {
        token: pick(row, 'Token', 'token'),
        tranId: pick(row, 'TranId', 'tranId'),
        maskedPan,
        last4: maskedPan.replace(/\D/g, '').slice(-4),
        brand: pick(row, 'CARDBRAND', 'cardBrand'),
        bank: pick(row, 'CARDISSUER', 'bankName'),
        alias: pick(row, 'CARD_ALIACE', 'cardAlias'),
      }
    })
    .filter((e) => e.tranId || e.token)
}

// ── Kayitli kartlari Paynkolay'dan cek (CardStorageCardList). PAYNKOLAY_SX ile
//    calisir — ayri bir "kart" sx'i YOK (2026-09-16 canli testte dogrulandi).
export async function fetchCardStorageList(
  vposUrl: string,
  sx: string,
  secretKey: string,
  customerKey: string,
): Promise<CardStorageEntry[] | null> {
  if (!vposUrl || !sx || !secretKey || !customerKey) return null
  const listUrl = `${vposUrl}/Payment/CardStorageCardList`
  try {
    const hash = await generatePaynkolayHash([sx, customerKey, secretKey])
    const form = new FormData()
    form.set('sx', sx)
    form.set('customerKey', customerKey)
    form.set('hashDatav2', hash)
    const res = await fetch(listUrl, { method: 'POST', body: form })
    const raw = await res.text()
    if (!res.ok) {
      console.error('[paynkolay-shared] CardStorageCardList HTTP', res.status)
      return null
    }
    let json: any = null
    try { json = JSON.parse(raw) } catch { return null }
    if (!isCardStorageListSuccess(json)) {
      console.error('[paynkolay-shared] CardStorageCardList ProcReturnCode != 00')
      return null
    }
    return parseCardStorageList(json)
  } catch (e) {
    console.error('[paynkolay-shared] CardStorageCardList fetch error:', e)
    return null
  }
}

// ── Kart kaydet/guncelle (token'a gore dedup). Hosted-callback kart-kaydetme
//    VE sync ORTAK kullanir.
export async function upsertUserCard(
  admin: SupabaseClient,
  userId: string,
  customerKey: string,
  entry: CardStorageEntry,
): Promise<void> {
  if (!entry.token) return

  const { data: existingCards } = await admin.from('user_cards').select('id').eq('user_id', userId)
  const existingIds = (existingCards ?? []).map((c: { id: string }) => c.id)
  if (existingIds.length > 0) {
    const { data: existingSecret } = await admin
      .from('user_card_secrets')
      .select('card_id')
      .in('card_id', existingIds)
      .eq('card_token', entry.token)
      .maybeSingle()
    if (existingSecret) return // zaten kayitli
  }

  const isFirst = existingIds.length === 0
  const { data: newCard, error: cardErr } = await admin
    .from('user_cards')
    .insert([{
      user_id: userId,
      paynkolay_customer_key: customerKey,
      last4: entry.last4 || null,
      brand: entry.brand || null,
      bank_name: entry.bank || null,
      is_default: isFirst,
    }])
    .select('id')
    .single()
  if (cardErr || !newCard) {
    console.error('[paynkolay-shared] user_cards insert failed:', cardErr)
    return
  }

  const { error: secretErr } = await admin
    .from('user_card_secrets')
    .insert([{ card_id: newCard.id, card_token: entry.token, cs_tran_id: entry.tranId || null }])
  if (secretErr) {
    console.error('[paynkolay-shared] user_card_secrets insert failed:', secretErr)
    await admin.from('user_cards').delete().eq('id', newCard.id)
  }
}

// ── Hosted donuste Token YOK, sadece TranId var (2026-09-16 canli testte
//    dogrulandi). Kart listesini cekip TranId eslesmesiyle yeni karti bulur.
//    Best-effort: odeme zaten basarili, kart kaydi basarisiz olsa da rollback yok.
export async function saveCardFromTranId(
  admin: SupabaseClient,
  cfg: { vposUrl: string; sx: string; secretKey: string },
  userId: string,
  tranId: string,
): Promise<void> {
  if (!tranId) return
  const { data: profile } = await admin
    .from('profiles')
    .select('payment_customer_key')
    .eq('id', userId)
    .maybeSingle()
  const customerKey = String(profile?.payment_customer_key ?? '')
  if (!customerKey) return

  const list = await fetchCardStorageList(cfg.vposUrl, cfg.sx, cfg.secretKey, customerKey)
  if (!list) return

  const match = list.find((e) => e.tranId === tranId)
  if (!match) {
    console.error('[paynkolay-shared] TranId eslesmedi (kart kaydi atlandi)', { tranId })
    return
  }
  await upsertUserCard(admin, userId, customerKey, match)
}

// ── Odeme sonucu tamamlama — paynkolay-callback (hosted donus) VE
//    paynkolay-cards (pay, non-3D senkron yanit) ORTAK kullanir. clientRefCode
//    formati her ikisinde de "KCAL{orderId}T..." (regex ile orderId cozulur).
export interface RawPaynkolayFields {
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
  tranId: string // kart-kaydetme tetikleyicisi (hosted donuste Token YOK, TranId VAR)
}

export interface CompletionConfig {
  secretKey: string
  vposUrl: string
  sx: string
}

export interface CompletionResult {
  matched: boolean
  hashValid: boolean
  isSuccess: boolean
  alreadyPaid: boolean
  orderId: number | null
  responseMessage: string
}

const FALLBACK_THRESHOLD = 15
const FALLBACK_MEMBERSHIP_DAYS = 30

// Paynkolay callback TIMESTAMP -> CancelRefundPayment trxDate formati (yyyy.mm.dd).
function toTrxDate(raw: string): string {
  const datePart = String(raw ?? '').trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart.replace(/-/g, '.')
  const now = new Date()
  const tr = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${tr.getUTCFullYear()}.${pad(tr.getUTCMonth() + 1)}.${pad(tr.getUTCDate())}`
}

type MacroOrder = {
  id: number | string
  user_id: string
  total_price: number | null
  type: string
  macro_quantity: number | null
}

async function completeMacroPurchase(admin: SupabaseClient, order: MacroOrder): Promise<void> {
  const macroQty = Number(order.macro_quantity ?? 0)
  if (!macroQty || macroQty <= 0) {
    console.warn('[macro] macro_purchase order without macro_quantity', order.id)
    return
  }
  if (!order.user_id) {
    console.warn('[macro] macro_purchase order without user_id', order.id)
    return
  }

  const { data: settings } = await admin
    .from('settings')
    .select('macro_threshold, macro_membership_days')
    .eq('id', 1)
    .maybeSingle()

  const threshold = Number(settings?.macro_threshold ?? FALLBACK_THRESHOLD)
  const membershipDays = Number(settings?.macro_membership_days ?? FALLBACK_MEMBERSHIP_DAYS)

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('macro_balance, total_macros_purchased, privileged_until')
    .eq('id', order.user_id)
    .maybeSingle()

  if (profileErr || !profile) {
    console.error('[macro] profile not found for order', order.id, profileErr)
    return
  }

  const newBalance = Number(profile.macro_balance ?? 0) + macroQty
  const newTotal = Number(profile.total_macros_purchased ?? 0) + macroQty

  const wasPrivilegedActive =
    !!profile.privileged_until && new Date(profile.privileged_until) > new Date()

  let privilegedUntil: string | null = profile.privileged_until
  let unlockedMembership = false

  if (newBalance >= threshold) {
    const base = wasPrivilegedActive
      ? new Date(profile.privileged_until as string)
      : new Date()
    base.setDate(base.getDate() + membershipDays)
    privilegedUntil = base.toISOString()
    if (!wasPrivilegedActive) unlockedMembership = true
  }

  const update: Record<string, unknown> = {
    macro_balance: newBalance,
    total_macros_purchased: newTotal,
  }
  if (privilegedUntil !== profile.privileged_until) {
    update.privileged_until = privilegedUntil
  }

  const { error: updateErr } = await admin
    .from('profiles')
    .update(update)
    .eq('id', order.user_id)

  if (updateErr) {
    console.error('[macro] profile update failed for order', order.id, updateErr)
    return
  }

  await admin.from('macro_transactions').insert({
    user_id: order.user_id,
    type: 'purchase',
    amount: macroQty,
    price_paid: Number(order.total_price ?? 0),
    order_id: typeof order.id === 'number' ? order.id : Number(order.id),
    note: `${macroQty} Macro Coin satin alindi`,
  })

  if (unlockedMembership) {
    await admin.from('macro_transactions').insert({
      user_id: order.user_id,
      type: 'membership_unlock',
      amount: 0,
      note: `Ayricalikli uyelik aktiflesti — ${membershipDays} gun`,
    })
  }
}

export async function completePaynkolayResult(
  admin: SupabaseClient,
  fields: RawPaynkolayFields,
  cfg: CompletionConfig,
): Promise<CompletionResult> {
  // ── clientRefCode'dan orderId'yi PARSE et -> orders.id ile bul (SADECE OKUMA).
  //    Format: KCAL{orderId}T{...} — init/pay AYNI onek'i uretir. Hash dogrulanana
  //    kadar order'a DOKUNULMAZ.
  let order: any = null
  const refMatch = /^KCAL(\d+)T/.exec(fields.clientRefCode)
  const parsedOrderId = refMatch ? Number(refMatch[1]) : null
  if (parsedOrderId) {
    const { data: o } = await admin
      .from('orders')
      .select('id, user_id, total_price, type, macro_quantity, status, payment_status')
      .eq('id', parsedOrderId)
      .maybeSingle()
    order = o
  }

  // ── RESPONSE HASH DOGRULAMA (sahte/gecersiz sonuc korumasi).
  //    Sira: MERCHANT_NO|REFERENCE_CODE|AUTH_CODE|RESPONSE_CODE|USE_3D|RND|
  //          INSTALLMENT|AUTHORIZATION_AMOUNT|CURRENCY_CODE|merchantSecretKey
  const expectedHash = await generatePaynkolayHash([
    fields.merchantNo, fields.referenceCode, fields.authCode, fields.responseCode,
    fields.use3D, fields.rnd, fields.installment, fields.authorizationAmount,
    fields.currencyCode, cfg.secretKey,
  ])
  const hashValid = !!fields.incomingHash && constantTimeEqual(expectedHash, fields.incomingHash)

  if (!hashValid) {
    console.error('[paynkolay-complete] HASH MISMATCH — sahte/gecersiz sonuc reddedildi', {
      clientRefCode: fields.clientRefCode,
      referenceCode: fields.referenceCode,
      responseCode: fields.responseCode,
      hasIncomingHash: !!fields.incomingHash,
    })
    if (order?.user_id) {
      try {
        await admin.from('failed_payments').insert([{
          user_id: order.user_id,
          error_message: 'Paynkolay hash mismatch — sahte/bozuk sonuc reddedildi',
          amount: 0,
          payment_method: 'kredi-karti',
          order_data: {
            reason: 'hash_mismatch',
            clientRefCode: fields.clientRefCode,
            referenceCode: fields.referenceCode,
            responseCode: fields.responseCode,
          },
          created_at: new Date().toISOString(),
        }])
      } catch (e) {
        console.error('[paynkolay-complete] failed_payments insert error (hash):', e)
      }
    }
    return {
      matched: !!order, hashValid: false, isSuccess: false, alreadyPaid: false,
      orderId: order?.id ?? null, responseMessage: 'Hash dogrulanamadi',
    }
  }

  if (!order) {
    console.log('[paynkolay-complete] order bulunamadi, clientRefCode:', fields.clientRefCode)
    return { matched: false, hashValid: true, isSuccess: false, alreadyPaid: false, orderId: null, responseMessage: 'Siparis bulunamadi' }
  }

  // ── IDEMPOTENCY: zaten paid ise tekrar isleme (cift bildirim guvenligi).
  if (order.payment_status === 'paid') {
    console.log('[paynkolay-complete] already paid, skipping order:', order.id)
    return { matched: true, hashValid: true, isSuccess: true, alreadyPaid: true, orderId: order.id, responseMessage: 'Zaten odenmis' }
  }

  // ── Basari kurali: RESPONSE_CODE===2 VE AUTH_CODE bos/0/00 degil VE
  //    AUTHORIZATION_AMOUNT >= beklenen tutar (esit VEYA BUYUK — resmi
  //    "Ödeme Sonucu" dokumanindaki kural; ONCEKI kural sadece RESPONSE_CODE
  //    bakiyordu ve tutari TAM ESITLIKLE karsilastiriyordu).
  const authCodeTrim = fields.authCode.trim()
  const codeOk = fields.responseCode === '2' && !['', '0', '00'].includes(authCodeTrim)

  let isSuccess = false
  if (codeOk) {
    const incomingCents = Math.round(parseFloat(String(fields.authorizationAmount || '0')) * 100)
    const orderCents = Math.round(Number(order.total_price ?? 0) * 100)
    isSuccess = !!incomingCents && incomingCents >= orderCents
    if (!isSuccess) {
      console.error('[paynkolay-complete] AMOUNT MISMATCH — reddedildi', {
        orderId: order.id, authorizationAmount: fields.authorizationAmount, orderTotal: order.total_price,
      })
      if (order.user_id) {
        try {
          await admin.from('failed_payments').insert([{
            user_id: order.user_id,
            error_message: `Paynkolay tutar uyusmazligi (gelen=${fields.authorizationAmount}, beklenen=${order.total_price})`,
            amount: 0,
            payment_method: 'kredi-karti',
            order_data: {
              reason: 'amount_mismatch', orderId: order.id,
              authorizationAmount: fields.authorizationAmount, orderTotal: order.total_price,
              clientRefCode: fields.clientRefCode, referenceCode: fields.referenceCode,
            },
            created_at: new Date().toISOString(),
          }])
        } catch (e) {
          console.error('[paynkolay-complete] amount-mismatch log error:', e)
        }
      }
      return { matched: true, hashValid: true, isSuccess: false, alreadyPaid: false, orderId: order.id, responseMessage: 'Tutar uyusmazligi' }
    }
  }

  console.log('[paynkolay-complete] order transition', {
    orderId: order.id, isSuccess, responseCode: fields.responseCode,
    referenceCode: fields.referenceCode, previousStatus: order.status ?? null,
  })

  // ── Orders update.
  const updatePayload: Record<string, unknown> = {
    status: isSuccess ? 'confirmed' : 'payment_failed',
    payment_status: isSuccess ? 'paid' : 'failed',
    payment_provider: 'paynkolay',
    updated_at: new Date().toISOString(),
  }
  if (!isSuccess) {
    updatePayload.payment_failure_reason =
      fields.responseMessage || `Paynkolay red (RESPONSE_CODE=${fields.responseCode || 'bilinmiyor'})`
  }
  if (isSuccess) {
    updatePayload.paynkolay_reference_code = fields.referenceCode || null
    updatePayload.paynkolay_trx_date = toTrxDate(fields.txnTimestamp)
  }
  const { error: updateError } = await admin.from('orders').update(updatePayload).eq('id', order.id)
  if (updateError) console.error('[paynkolay-complete] order update error:', updateError)

  // ── FAILED_PAYMENTS audit (basarisiz odeme, genel).
  if (!isSuccess && order.user_id) {
    try {
      await admin.from('failed_payments').insert([{
        user_id: order.user_id,
        error_message: fields.responseMessage || `Odeme basarisiz (RESPONSE_CODE=${fields.responseCode || 'bilinmiyor'})`,
        amount: 0,
        payment_method: 'kredi-karti',
        order_data: {
          orderId: order.id, clientRefCode: fields.clientRefCode, referenceCode: fields.referenceCode,
          authCode: fields.authCode, responseCode: fields.responseCode,
        },
        created_at: new Date().toISOString(),
      }])
    } catch (e) {
      console.error('[paynkolay-complete] failed_payments insert error:', e)
    }
  }

  // ── KART SAKLAMA: flag acik VEYA kullanici admin_allowlist'te + basari +
  //    TranId geldiyse (hosted donuste Token YOK, sadece TranId var).
  if (isSuccess && fields.tranId && order.user_id) {
    try {
      const allowed = CARD_SAVE_ENABLED || await isAllowlistedAdmin(admin, order.user_id)
      if (allowed) {
        await saveCardFromTranId(admin, cfg, order.user_id, fields.tranId)
      }
    } catch (e) {
      console.error('[paynkolay-complete] saveCardFromTranId failed for order', order.id, e)
    }
  }

  // ── Macro purchase tamamlama.
  if (isSuccess && order.type === 'macro_purchase' && order.status !== 'confirmed') {
    try {
      await completeMacroPurchase(admin, order)
    } catch (macroErr) {
      console.error('[macro] completeMacroPurchase FAILED for order', order.id, macroErr)
    }
  }

  return { matched: true, hashValid: true, isSuccess, alreadyPaid: false, orderId: order.id, responseMessage: fields.responseMessage }
}
