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
      // TESHIS: sadece hata kodu/mesaji — token/kart/customerKey ASLA loglanmaz.
      console.error('[paynkolay-shared] CardStorageCardList ProcReturnCode != 00', {
        procReturnCode: json?.ProcReturnCode,
        errMsg: json?.ErrMsg,
      })
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
      card_alias: entry.alias || null,
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

// ── Kayıtlı kartı Paynkolay tarafında sil (CardStorageCardDelete). paynkolay-
//    cards (kullanıcı elle siler) VE delete-account (hesap silme) TARAFINDAN
//    PAYLAŞILIR — hash/endpoint TEK YERDE. sx/secretKey/vposUrl veya token
//    boşsa (yapılandırma eksik ya da hiç saklanmamış) sessizce { ok: true }
//    döner (yapılacak bir şey yok, hata değil) — çağıran taraf local silmeye
//    devam eder.
export async function deleteCardFromPaynkolay(params: {
  vposUrl: string
  sx: string
  secretKey: string
  customerKey: string
  tranId: string
  token: string
}): Promise<{ ok: boolean; error?: string }> {
  const { vposUrl, sx, secretKey, customerKey, tranId, token } = params
  if (!sx || !secretKey || !vposUrl || !token) {
    return { ok: true }
  }
  const deleteUrl = `${vposUrl}/Payment/CardStorageCardDelete`
  try {
    const hash = await generatePaynkolayHash([sx, customerKey, tranId, token, secretKey])
    const form = new FormData()
    form.set('sx', sx)
    form.set('customerKey', customerKey)
    form.set('tranId', tranId)
    form.set('token', token)
    form.set('hashDatav2', hash)
    const res = await fetch(deleteUrl, { method: 'POST', body: form })
    const raw = await res.text()
    if (!res.ok) {
      console.error('[paynkolay-shared] delete HTTP', res.status)
      return { ok: false, error: `HTTP ${res.status}` }
    }
    let json: any = null
    try { json = JSON.parse(raw) } catch { json = null }
    if (!json) {
      // GÜVENLİK: token içeriyorsa ham yanıt loglanmaz.
      if (raw.includes(token)) {
        console.error('[paynkolay-shared] delete yaniti JSON degil (token icerdigi icin ham yanit loglanmadi)')
      } else {
        console.error('[paynkolay-shared] delete yaniti JSON degil:', raw)
      }
      return { ok: false, error: 'Yanit anlasilamadi' }
    }
    const procCode = String(json?.ProcReturnCode ?? '')
    if (procCode !== '00') {
      console.error('[paynkolay-shared] delete ProcReturnCode != 00:', procCode)
      return { ok: false, error: `ProcReturnCode ${procCode}` }
    }
    return { ok: true }
  } catch (e) {
    console.error('[paynkolay-shared] delete fetch error:', e)
    return { ok: false, error: String(e) }
  }
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
      .select('id, user_id, total_price, type, macro_quantity, status, payment_status, merchant_oid')
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

  await applyPaynkolayOutcome(admin, order, {
    isSuccess,
    referenceCode: fields.referenceCode,
    txnTimestamp: fields.txnTimestamp,
    responseMessage: fields.responseMessage,
    tranId: fields.tranId,
    clientRefCode: fields.clientRefCode,
    authCode: fields.authCode,
    responseCodeRaw: fields.responseCode,
    source: 'hash_verified',
  }, cfg)

  return { matched: true, hashValid: true, isSuccess, alreadyPaid: false, orderId: order.id, responseMessage: fields.responseMessage }
}

// ── Odeme sonucu ORTAK uygulama adimi: orders update + failed_payments audit +
//    kart kaydetme + macro purchase. completePaynkolayResult (hash-dogrulanmis
//    yol) VE verifyAndFinalizeViaReport (rapor-dogrulanmis fallback yolu) ORTAK
//    kullanir — isSuccess kararini caller verir, bu fonksiyon SADECE uygular.
export interface ApplyOutcomeParams {
  isSuccess: boolean
  referenceCode: string
  txnTimestamp: string
  responseMessage: string
  tranId: string
  clientRefCode: string
  authCode?: string
  responseCodeRaw?: string
  source: 'hash_verified' | 'report_verified'
}

export type OrderForOutcome = {
  id: number
  user_id: string | null
  total_price: number | null
  type: string | null
  macro_quantity: number | null
  status: string | null
  payment_status: string | null
  merchant_oid?: string | null
}

async function applyPaynkolayOutcome(
  admin: SupabaseClient,
  order: OrderForOutcome,
  params: ApplyOutcomeParams,
  cfg: CompletionConfig,
): Promise<void> {
  const { isSuccess } = params

  console.log('[paynkolay-complete] order transition', {
    orderId: order.id, isSuccess, source: params.source, previousStatus: order.status ?? null,
  })

  // ── Orders update. merchant_oid: bos ise BU denemenin clientRefCode'unu
  //    dolduruyor (init'teki "ilk ref'i sakla, ezme" davranisiyla AYNI) —
  //    saklı-kart odemeleri de boylece iade akisinda "merchant_oid yok" guard'ina
  //    carpmaz.
  const updatePayload: Record<string, unknown> = {
    status: isSuccess ? 'confirmed' : 'payment_failed',
    payment_status: isSuccess ? 'paid' : 'failed',
    payment_provider: 'paynkolay',
    // Bu fonksiyon her cagrildiginda kesin bir sonuca ulasilmis olur (basari/
    // basarisizlik) -> "belirsiz, incelemede" bayragi artik gecerli degil.
    // hash/pay yolunda zaten false'tur (no-op); sweep/report yolunda gercekten temizler.
    payment_review_pending: false,
    updated_at: new Date().toISOString(),
  }
  if (!isSuccess) {
    updatePayload.payment_failure_reason =
      params.responseMessage || `Paynkolay red (RESPONSE_CODE=${params.responseCodeRaw || 'bilinmiyor'})`
  }
  if (isSuccess) {
    updatePayload.paynkolay_reference_code = params.referenceCode || null
    updatePayload.paynkolay_trx_date = toTrxDate(params.txnTimestamp)
    if (!order.merchant_oid) updatePayload.merchant_oid = params.clientRefCode
  }
  const { error: updateError } = await admin.from('orders').update(updatePayload).eq('id', order.id)
  if (updateError) console.error('[paynkolay-complete] order update error:', updateError)

  // ── FAILED_PAYMENTS audit (basarisiz odeme, genel).
  if (!isSuccess && order.user_id) {
    try {
      await admin.from('failed_payments').insert([{
        user_id: order.user_id,
        error_message: params.responseMessage || `Odeme basarisiz (RESPONSE_CODE=${params.responseCodeRaw || 'bilinmiyor'})`,
        amount: 0,
        payment_method: 'kredi-karti',
        order_data: {
          orderId: order.id, clientRefCode: params.clientRefCode, referenceCode: params.referenceCode,
          authCode: params.authCode, responseCode: params.responseCodeRaw, source: params.source,
        },
        created_at: new Date().toISOString(),
      }])
    } catch (e) {
      console.error('[paynkolay-complete] failed_payments insert error:', e)
    }
  }

  // ── KART SAKLAMA: flag acik VEYA kullanici admin_allowlist'te + basari +
  //    TranId geldiyse (hosted donuste Token YOK, sadece TranId var).
  if (isSuccess && params.tranId && order.user_id) {
    try {
      const allowed = CARD_SAVE_ENABLED || await isAllowlistedAdmin(admin, order.user_id)
      if (allowed) {
        await saveCardFromTranId(admin, cfg, order.user_id, params.tranId)
      }
    } catch (e) {
      console.error('[paynkolay-complete] saveCardFromTranId failed for order', order.id, e)
    }
  }

  // ── Macro purchase tamamlama.
  if (isSuccess && order.type === 'macro_purchase' && order.status !== 'confirmed') {
    try {
      await completeMacroPurchase(admin, order as MacroOrder)
    } catch (macroErr) {
      console.error('[macro] completeMacroPurchase FAILED for order', order.id, macroErr)
    }
  }
}

// ── Raporlama (PfTransactionReportList) sorgusu — paynkolay-query'den TASINDI.
//    paynkolay-query (admin diagnostik/iade fallback) VE paynkolay-cards (pay
//    non-3D hash dogrulanamazsa yedek dogrulama) ORTAK kullanir.
export class PaynkolayReportError extends Error {
  httpStatus?: number
  detail?: unknown
  constructor(message: string, httpStatus?: number, detail?: unknown) {
    super(message)
    this.httpStatus = httpStatus
    this.detail = detail
  }
}

export interface ReportConfig {
  reportSx: string
  secretKey: string
  vposUrl: string
}

export interface ReportedTransaction {
  found: boolean
  referenceCode: string
  status: string // SUCCESS | ERROR | NEW
  transactionType: string
  trxDate: string // yyyy.mm.dd (normalize)
  trxDateRaw: string
  amount: string
  clientReferenceCode: string
  range: { startDate: string; endDate: string }
}

// Reporting startDate/endDate formati: DD.MM.YYYY (UTC tabanli; ±3 gun marji
// timezone farkini zaten yutar).
function fmtDDMMYYYY(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`
}

// Reporting trxDate -> orders.paynkolay_trx_date formati (yyyy.mm.dd) normalize.
function toYmdDots(raw: string): string {
  const s = String(raw ?? '').trim()
  let m = /^(\d{4})[.\-](\d{2})[.\-](\d{2})/.exec(s)
  if (m) return `${m[1]}.${m[2]}.${m[3]}`
  m = /^(\d{2})[.\-](\d{2})[.\-](\d{4})/.exec(s)
  if (m) return `${m[3]}.${m[2]}.${m[1]}`
  return ''
}

// clientRefCode'a gore PfTransactionReportList'ten islem sorgula. referenceDate
// merkez tarih, ±3 gun pencere (paynkolay-query'nin ORIJINAL mantigi ile AYNI).
// Hard-failure'da (config eksik/fetch hatasi/HTTP hata) PaynkolayReportError
// FIRLATIR; "bulunamadi" (found:false) normal bir sonuctur, hata DEGILDIR.
export async function queryPaynkolayTransactionReport(
  cfg: ReportConfig,
  clientRefCode: string,
  referenceDate: Date,
): Promise<ReportedTransaction> {
  if (!cfg.reportSx || !cfg.secretKey || !cfg.vposUrl) {
    throw new PaynkolayReportError('Paynkolay reporting yapilandirmasi eksik')
  }
  const reportUrl = `${cfg.vposUrl}/Payment/PfTransactionReportList`

  const start = new Date(referenceDate.getTime() - 3 * 86400000)
  let end = new Date(referenceDate.getTime() + 3 * 86400000)
  const now = new Date()
  if (end.getTime() > now.getTime()) end = now
  const startDate = fmtDDMMYYYY(start)
  const endDate = fmtDDMMYYYY(end)
  const range = { startDate, endDate }

  // Hash: sx | startDate | endDate | clientReferenceCode | referenceCode | secret
  const hash = await generatePaynkolayHash([cfg.reportSx, startDate, endDate, clientRefCode, '', cfg.secretKey])
  const form = new FormData()
  form.set('sx', cfg.reportSx)
  form.set('startDate', startDate)
  form.set('endDate', endDate)
  form.set('clientReferenceCode', clientRefCode)
  form.set('referenceCode', '')
  form.set('hashDatav2', hash)

  let res: Response
  try {
    res = await fetch(reportUrl, { method: 'POST', body: form })
  } catch {
    throw new PaynkolayReportError('Paynkolay reporting API erisilemedi')
  }
  const raw = await res.text()
  let json: any = null
  try { json = JSON.parse(raw) } catch { json = { raw } }
  if (!res.ok) {
    console.error('[paynkolay-shared] reporting HTTP', res.status)
    throw new PaynkolayReportError('Paynkolay reporting API hatasi', res.status, json)
  }

  const list: any[] = Array.isArray(json?.List) ? json.List
    : Array.isArray(json?.list) ? json.list
    : []
  const matches = list.filter((t) => String(t?.clientReferenceCode ?? '') === clientRefCode)
  const sale = matches.find((t) => String(t?.transactionType ?? '').toUpperCase() === 'SALES')
    ?? matches[0]
    ?? null

  if (!sale) {
    return { found: false, referenceCode: '', status: '', transactionType: '', trxDate: '', trxDateRaw: '', amount: '', clientReferenceCode: clientRefCode, range }
  }

  const trxDateRaw = String(sale.trxDate ?? '')
  return {
    found: true,
    referenceCode: String(sale.referenceCode ?? ''),
    status: String(sale.status ?? ''),
    transactionType: String(sale.transactionType ?? ''),
    trxDate: toYmdDots(trxDateRaw),
    trxDateRaw,
    amount: pick(sale, 'amount', 'Amount', 'AMOUNT', 'transactionAmount', 'TRANSACTION_AMOUNT', 'authorizationAmount', 'AUTHORIZATION_AMOUNT'),
    clientReferenceCode: clientRefCode,
    range,
  }
}

// ── Bekleyen (hash/HTTP ile hemen teyit edilemeyen) bir odemeyi PfTransactionReportList
//    ile yeniden dener. paynkolay-cards pay (hash gecersiz/eksik ama HTTP 200
//    geldiyse ANINDA) VE paynkolay-review-sweep (5dk cron, needs_manual_review
//    siparisler icin TEKRAR) ORTAK kullanir.
//    - 'success': rapor status===SUCCESS + tutar >= beklenen -> siparis
//      "report_verified" kaynagiyla BASARILI tamamlandi (order update + kart
//      kaydetme + macro purchase applyPaynkolayOutcome uzerinden).
//    - 'failed': rapor status===ERROR -> siparis KESIN BASARISIZ tamamlandi
//      (order'a dokunulur, payment_failed/failed).
//    - 'still_pending': rapor bulunamadi VEYA status NEW/bilinmiyor VEYA
//      SUCCESS ama tutar tutmuyor -> siparise DOKUNULMAZ, caller bekler/loglar.
//    TranId rapor yanitinda YOK -> bu yoldan YENI kart kaydi denenmez.
export type ReviewSweepOutcome = 'success' | 'failed' | 'still_pending'

export async function resolvePendingPaymentViaReport(
  admin: SupabaseClient,
  order: OrderForOutcome,
  clientRefCode: string,
  reportCfg: ReportConfig,
  cfg: CompletionConfig,
): Promise<ReviewSweepOutcome> {
  let report: ReportedTransaction
  try {
    report = await queryPaynkolayTransactionReport(reportCfg, clientRefCode, new Date())
  } catch (e) {
    console.error('[paynkolay-complete] report sorgu hatasi:', e)
    return 'still_pending'
  }
  if (!report.found) return 'still_pending'

  const statusUpper = report.status.toUpperCase()

  if (statusUpper === 'SUCCESS') {
    const incomingCents = Math.round(parseFloat(String(report.amount || '0')) * 100)
    const orderCents = Math.round(Number(order.total_price ?? 0) * 100)
    const amountOk = !!incomingCents && incomingCents >= orderCents
    if (!amountOk) {
      // SUCCESS ama tutar tutmuyor -> otomatik BASARISIZ SAYMA (para hareketi
      // olmus olabilir), insana birak; sweep 24h icinde tekrar deneyecek.
      console.error('[paynkolay-complete] report SUCCESS ama tutar uyusmuyor', {
        orderId: order.id, incomingCents, orderCents,
      })
      return 'still_pending'
    }
    await applyPaynkolayOutcome(admin, order, {
      isSuccess: true,
      referenceCode: report.referenceCode,
      txnTimestamp: report.trxDateRaw,
      responseMessage: 'report_verified',
      tranId: '',
      clientRefCode,
      source: 'report_verified',
    }, cfg)
    await markHashMismatchResolvedByReport(admin, order, clientRefCode)
    return 'success'
  }

  if (statusUpper === 'ERROR') {
    await applyPaynkolayOutcome(admin, order, {
      isSuccess: false,
      referenceCode: report.referenceCode,
      txnTimestamp: report.trxDateRaw,
      responseMessage: 'Paynkolay raporu: islem basarisiz (report_verified)',
      tranId: '',
      clientRefCode,
      source: 'report_verified',
    }, cfg)
    return 'failed'
  }

  // NEW veya bilinmeyen status -> Paynkolay tarafinda hala islemde, bekle.
  return 'still_pending'
}

// ── Kozmetik duzeltme: rapor SONRADAN basariyi dogrularsa, ANINDA yazilmis
//    olan 'hash_mismatch' failed_payments kaydini "aslinda basariliydi" diye
//    isaretle (silmez — audit trail korunur, sadece not eklenir).
async function markHashMismatchResolvedByReport(
  admin: SupabaseClient,
  order: OrderForOutcome,
  clientRefCode: string,
): Promise<void> {
  if (!order.user_id) return
  try {
    const { data: rows } = await admin
      .from('failed_payments')
      .select('id, order_data')
      .eq('user_id', order.user_id)
      .contains('order_data', { reason: 'hash_mismatch', clientRefCode })
      .order('created_at', { ascending: false })
      .limit(1)
    const row = rows?.[0]
    if (!row) return
    const nextData = { ...(row.order_data as Record<string, unknown>), resolved_by_report: true }
    await admin.from('failed_payments').update({ order_data: nextData }).eq('id', row.id)
  } catch (e) {
    console.error('[paynkolay-complete] markHashMismatchResolvedByReport error:', e)
  }
}

// ── Siparisi "belirsiz, incelemede" isaretle: ne hash ne rapor hemen teyit
//    edemedi. Order'a DOKUNULMAZ (status/payment_status ayni kalir) — sadece
//    payment_review_pending=true + needs_manual_review audit. merchant_oid
//    bos ise BU denemenin clientRefCode'u ile doldurulur (sweep'in rapor
//    sorgusu icin gerekli — init'teki "ilk ref'i sakla" davranisiyla AYNI).
export async function markOrderPendingReview(
  admin: SupabaseClient,
  order: OrderForOutcome,
  clientRefCode: string,
  errorMessage: string,
): Promise<void> {
  const updatePayload: Record<string, unknown> = {
    payment_review_pending: true,
    payment_review_started_at: new Date().toISOString(),
  }
  if (!order.merchant_oid) updatePayload.merchant_oid = clientRefCode
  const { error } = await admin.from('orders').update(updatePayload).eq('id', order.id)
  if (error) console.error('[paynkolay-complete] markOrderPendingReview update error:', error)

  if (order.user_id) {
    try {
      await admin.from('failed_payments').insert([{
        user_id: order.user_id,
        error_message: errorMessage,
        amount: 0,
        payment_method: 'kredi-karti-saklı',
        order_data: { reason: 'needs_manual_review', orderId: order.id, clientRefCode },
        created_at: new Date().toISOString(),
      }])
    } catch (e) {
      console.error('[paynkolay-complete] needs_manual_review log error:', e)
    }
  }
}
