import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  CardStorageEntry,
  deleteCardFromPaynkolay,
  fetchCardStorageListDiag,
  generatePaynkolayHash,
  isAllowlistedAdmin,
  ListOutcome,
  upsertUserCard,
} from '../_shared/paynkolay-cards.ts'
import { planOrphans } from '../_shared/paynkolay-card-storage.ts'
import { parsePay3DResponse } from '../_shared/paynkolay-3d.ts'
import { buildCardVerificationForm, getRnd as verifyRnd, toDecimalTL as verifyToDecimalTL } from '../_shared/paynkolay-hosted-form.ts'
import { insertVerification, prepareVerificationStart } from '../_shared/paynkolay-card-verification.ts'
import { toPublicStatus } from '../_shared/paynkolay-verification-flow.ts'
import { VERIFICATION_AMOUNT } from '../_shared/paynkolay-verification.ts'

// ── Paynkolay "Saklı Kart" yönetimi (sync/pay/delete/set_default) ──────────
// Kart Saklama API'leri (2026-09-16 canli test ile dogrulandi):
//   - Kayıtlı Kartları Listele: POST {VPOS_URL}/Payment/CardStorageCardList
//       hash: sx | customerKey | secret — PAYNKOLAY_SX ile calisir (ayri "kart" sx'i YOK).
//   - Kayıtlı Kartı Sil:        POST {VPOS_URL}/Payment/CardStorageCardDelete
//       hash: sx | customerKey | tranId | token | secret
//   - Saklı Kart ile Ödeme Al:  POST {VPOS_URL}/v1/Payment
//       hash: sx | clientRefCode | amount | successUrl | failUrl | rnd | csCustomerKey | secret
//
// Saklı kartla ödeme HER ZAMAN 3D'li (use3D=true) — 3D'siz işlem yetkisi talep
// edilmiyor (karar, 2026-09-18). Sonuç PaynKolay tarafından paynkolay-callback'e
// POST edilir; odeme sonucu tamamlama (hash dogrulama, basari kurali, order
// update, kart kaydetme, macro purchase) _shared/paynkolay-cards.ts::
// completePaynkolayResult icinde, TEK YERDE (burada kopyalanmaz).
//
// JWT ZORUNLU (verify_jwt=true, config.toml). Kullanıcı SADECE kendi kartını
// görebilir/kullanabilir/silebilir — her sorguda user_id = auth.uid() teyidi var.
//
// TEST ASAMASI: PAYNKOLAY_CARD_SAVE kapaliyken bu fonksiyonun TUM action'lari
// (sync/pay/delete/set_default) yalnizca admin_allowlist'teki kullanicilara acik.
//
// GÜVENLİK: token / card_token / secret / kart numarası LOGLANMAZ. Client'a da
// (sync/list yanıtlarında) token dönülmez — yalnızca last4/brand/bank/is_default.

const SX = (Deno.env.get('PAYNKOLAY_SX') ?? '').trim()
const SECRET_KEY = (Deno.env.get('PAYNKOLAY_SECRET_KEY') ?? '').trim()
const VPOS_URL = (Deno.env.get('PAYNKOLAY_VPOS_URL') ?? '').trim() // ".../Vpos"
const CARD_SAVE_ENABLED = (Deno.env.get('PAYNKOLAY_CARD_SAVE') ?? 'false').toLowerCase() === 'true'
// agentCode SADECE sub-merchant secret'ı tanımlıysa (payment-init ile aynı kural).
const AGENT_CODE = (Deno.env.get('PAYNKOLAY_AGENT_CODE') ?? '').trim()

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const PAY_URL = VPOS_URL ? `${VPOS_URL}/v1/Payment` : ''
const CALLBACK_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/paynkolay-callback` : ''

const CURRENCY_CODE = '949' // TRY — payment-init ile aynı

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// Paynkolay rnd = "dd.MM.yyyy HH:mm:ss" (payment-init ile AYNI, GMT+3).
function getRnd(): string {
  const now = new Date()
  const tr = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(tr.getUTCDate())}.${pad(tr.getUTCMonth() + 1)}.${tr.getUTCFullYear()} ` +
    `${pad(tr.getUTCHours())}:${pad(tr.getUTCMinutes())}:${pad(tr.getUTCSeconds())}`
}

function clientIpFromRequest(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') ?? ''
  const first = xff.split(',')[0]?.trim()
  if (first) return first
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? '0.0.0.0'
}

// amount -> ondalik TL string ("150.00"). payment-init ile AYNI.
function toDecimalTL(value: number): string {
  return Number(value || 0).toFixed(2)
}

type OrderRow = {
  id: number
  user_id: string | null
  total_price: number | null
  total_amount: number | null
  phone: string | null
  merchant_oid: string | null
  items: unknown
  subtotal_amount: number | null
  delivery_fee: number | null
  discount_amount: number | null
  macro_discount_amount: number | null
  coupon_id: unknown
  coupon_code: string | null
  type: string | null
  macro_quantity: number | null
  status: string | null
  payment_status: string | null
  payment_review_pending?: boolean | null
}

// ── Tutarı sunucuda yeniden hesapla — paynkolay-payment-init'teki mantığın
//    BİREBİR YANSIMASI (bilerek kopya: bu repoda her provider/endpoint kendi
//    recompute kopyasını taşır — bkz. payment-verify/paytr-payment-init/
//    paynkolay-payment-init, aynı desen). payment-init değişirse burası da
//    elle güncellenmeli.
async function recomputeOrderAmount(
  admin: SupabaseClient,
  authedClient: SupabaseClient,
  order: OrderRow,
): Promise<number> {
  let amountNum = Number(order.total_price ?? order.total_amount ?? 0)

  if (order.type === 'macro_purchase') {
    const qty = Number(order.macro_quantity) || 0
    if (qty <= 0) return amountNum
    const { data: settingsRow } = await admin
      .from('settings')
      .select('macro_price')
      .eq('id', 1)
      .maybeSingle()
    const macroPrice = Number(settingsRow?.macro_price) || 1500
    const expected = Math.round(qty * macroPrice * 100) / 100
    amountNum = expected
    await admin.from('orders').update({ total_price: expected, total_amount: expected }).eq('id', order.id)
    return amountNum
  }

  try {
    const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100
    const effPrice = (price: unknown, type: unknown, value: unknown) => {
      const base = Number(price) || 0
      const v = Number(value)
      if (!type || !Number.isFinite(v) || v <= 0) return base
      if (type === 'percent' || type === 'percentage') return Math.max(0, base * (1 - v / 100))
      if (type === 'fixed') return Math.max(0, base - v)
      return base
    }
    const items: any[] = Array.isArray(order.items) ? order.items : []
    if (items.length > 0) {
      const productIds = items
        .map((it) => parseInt(String(it?.id), 10))
        .filter((n) => Number.isFinite(n))
      const { data: prods } = await admin
        .from('products')
        .select('id, price, discount_type, discount_value')
        .in('id', productIds)
      const pmap = new Map<number, any>((prods ?? []).map((p: any) => [Number(p.id), p]))

      const newItems = items.map((it) => {
        const p = pmap.get(parseInt(String(it?.id), 10))
        if (!p) return it
        const baseServer = effPrice(p.price, p.discount_type, p.discount_value)
        const tplMod = Array.isArray(it?.selected_options)
          ? it.selected_options.reduce((s: number, o: any) => s + (Number(o?.price_modifier) || 0), 0)
          : 0
        const extra = Number(it?.legacy_selected_options?.extraPrice) || 0
        const correctUnit = round2(baseServer + tplMod + extra)
        const qty = Number(it?.quantity) || 1
        return { ...it, unit_price: correctUnit, total_price: round2(correctUnit * qty) }
      })

      const newSubtotal = round2(newItems.reduce((s, it) => s + (Number(it?.total_price) || 0), 0))

      let macroDiscount = 0
      const { data: prof } = await admin
        .from('profiles').select('privileged_until').eq('id', order.user_id).maybeSingle()
      const pu = prof?.privileged_until ? new Date(prof.privileged_until) : null
      if (pu && pu.getTime() > Date.now()) macroDiscount = round2(newSubtotal * 0.20)

      let discount = 0
      if (order.coupon_code) {
        const { data: cv } = await authedClient.rpc('validate_coupon', {
          p_code: order.coupon_code,
          p_cart_total: newSubtotal,
        })
        if (cv?.valid) discount = round2(Number(cv.discount_amount) || 0)
      }

      const deliveryFee = Number(order.delivery_fee) || 0
      const newTotal = round2(Math.max(0, newSubtotal + deliveryFee - discount - macroDiscount))

      if (newTotal > 0) {
        amountNum = newTotal
        await admin.from('orders').update({
          items: newItems,
          subtotal_amount: newSubtotal,
          discount_amount: discount,
          macro_discount_amount: macroDiscount,
          total_amount: newTotal,
          total_price: newTotal,
        }).eq('id', order.id)
      }
    }
  } catch (e) {
    console.error('[paynkolay-cards] recompute failed, stored total kullanilacak:', (e as Error).message)
  }

  return amountNum
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Oturum doğrulanamadı' }, 401)

    const authedClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await authedClient.auth.getUser()
    if (authError || !user) return jsonResponse({ error: 'Oturum doğrulanamadı' }, 401)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    let body: any = {}
    try {
      const text = await req.text()
      if (text) body = JSON.parse(text)
    } catch { body = {} }

    const action = String(body?.action ?? '')

    // ── TEST ASAMASI: flag kapaliyken ozellik SADECE admin_allowlist'e acik
    //    (2026-09-16, kullanici talebi). 'status' action'i bu guard'in DISINDA —
    //    mobil, kullaniciya kart UI'sini gostermeden once bunu sorup ogrenir;
    //    403 ALMAZ.
    const featureAllowed = CARD_SAVE_ENABLED || await isAllowlistedAdmin(admin, user.id, user.email ?? undefined)

    if (action === 'status') {
      return jsonResponse({ enabled: featureAllowed })
    }

    if (!featureAllowed) {
      return jsonResponse({ error: 'Bu özellik şu anda test aşamasında.' }, 403)
    }

    if (action === 'sync') return await handleSync(admin, user.id)
    if (action === 'pay') return await handlePay(req, admin, authedClient, user.id, body)
    if (action === 'delete') return await handleDelete(admin, user.id, body)
    if (action === 'set_default') return await handleSetDefault(admin, user.id, body)
    if (action === 'verify_start') return await handleVerifyStart(req, admin, user.id)
    if (action === 'verify_status') return await handleVerifyStatus(admin, user.id, body)
    if (action === 'verify_cancel') return await handleVerifyCancel(admin, user.id, body)

    return jsonResponse({ error: 'Geçersiz action (status|sync|pay|delete|set_default|verify_start|verify_status|verify_cancel bekleniyor)' }, 400)
  } catch (err) {
    console.error('[paynkolay-cards] error:', String(err))
    return jsonResponse({ error: 'İşlem tamamlanamadı' }, 500)
  }
})

async function fetchLocalCards(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from('user_cards')
    .select('id, last4, brand, bank_name, is_default, created_at')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
  return data ?? []
}

// ── sync: Paynkolay'daki kayıtlı kartları çek, DB'de eksik olanları ekle.
//    Yalnızca EKLEME yapar — DB'de olup Paynkolay yanıtında görünmeyen kartları
//    SİLMEZ (yanıt parse hatasında tüm kartları yanlışlıkla silme riskine karşı
//    bilerek tek-yönlü/ek-only; kullanıcı 'delete' action'ı ile açıkça siler).
async function handleSync(admin: SupabaseClient, userId: string): Promise<Response> {
  const { data: profile } = await admin
    .from('profiles')
    .select('payment_customer_key')
    .eq('id', userId)
    .maybeSingle()
  const customerKey = String(profile?.payment_customer_key ?? '')

  if (!customerKey) {
    const cards = await fetchLocalCards(admin, userId)
    return jsonResponse({ success: true, cards, synced: false })
  }

  // Teshis alanlari (procReturnCode/errMsg) SADECE bilgi amacli — token/kart/
  // customerKey burada da ASLA donulmez (bkz. fetchCardStorageListDiag).
  const fetchStartedAtMs = Date.now()
  const diag = await fetchCardStorageListDiag(VPOS_URL, SX, SECRET_KEY, customerKey)
  const remoteList = diag.entries

  if (remoteList && remoteList.length > 0) {
    const { data: existingCards } = await admin.from('user_cards').select('id').eq('user_id', userId)
    const existingIds = (existingCards ?? []).map((c: { id: string }) => c.id)
    const { data: existingSecrets } = existingIds.length > 0
      ? await admin.from('user_card_secrets').select('card_id, card_token').in('card_id', existingIds)
      : { data: [] as { card_id: string; card_token: string }[] }
    const knownTokens = new Set((existingSecrets ?? []).map((s) => s.card_token))

    for (const entry of remoteList as CardStorageEntry[]) {
      if (!entry.token || knownTokens.has(entry.token)) continue
      await upsertUserCard(admin, userId, customerKey, entry)
      knownTokens.add(entry.token)
    }
  }

  // YETİM TEMİZLİĞİ: PaynKolay listesinde olmayan yerel kartlar silinir. YALNIZ liste kesin
  // geldiyse ("listed" ya da "Gecerli Kart Yok"); liste alınamadıysa HİÇBİR ŞEY silinmez.
  let pruned = 0
  try {
    pruned = await pruneOrphanCards(admin, userId, customerKey, diag.outcome, fetchStartedAtMs)
  } catch (e) {
    console.error('[paynkolay-cards] sync yetim temizliği hatası:', (e as Error).message)
  }

  // Yetki teşhisi için (token/kart/customerKey YOK): sadece durum kodu + mesaj.
  console.log('[paynkolay-cards] sync CardStorageCardList', {
    pruned,
    ok: diag.ok,
    httpStatus: diag.httpStatus,
    procReturnCode: diag.procReturnCode,
    errMsg: diag.errMsg,
    cardCount: remoteList?.length ?? null,
  })

  const cards = await fetchLocalCards(admin, userId)
  return jsonResponse({
    success: true,
    cards,
    synced: remoteList !== null,
    procReturnCode: diag.procReturnCode,
    errMsg: diag.errMsg,
  })
}

// ── verify_start: "Kart Ekle" — 1 TL'lik doğrulama işlemini başlatır (SİPARİŞ DEĞİL).
//    Kapı: yukarıdaki featureAllowed (PAYNKOLAY_CARD_SAVE veya admin_allowlist).
//    Sıra: zaman aşımına uğrayan açık kayıtlar kapatılır -> hâlâ açık (<15 dk) kayıt
//    varsa YENİSİ başlatılmaz (409, mevcut kaydın id'siyle) -> günlük 3 limit (429)
//    -> kayıt + hosted form. Aynı anda tek açık kayıt DB'de de zorunlu (kısmi unique).
async function handleVerifyStart(req: Request, admin: SupabaseClient, userId: string): Promise<Response> {
  if (!SX || !SECRET_KEY || !VPOS_URL || !CALLBACK_URL) {
    return jsonResponse({ error: 'PaynKolay kart doğrulama yapılandırması eksik' }, 500)
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('payment_customer_key')
    .eq('id', userId)
    .maybeSingle()
  const customerKey = String(profile?.payment_customer_key ?? '')
  if (!customerKey) return jsonResponse({ error: 'Müşteri anahtarı bulunamadı' }, 400)

  let plan
  try {
    plan = await prepareVerificationStart(admin, userId)
  } catch (e) {
    console.error('[paynkolay-cards] verify_start hazırlık hatası:', (e as Error).message)
    return jsonResponse({ error: 'İşlem başlatılamadı' }, 500)
  }
  if (plan.decision === 'in_progress') {
    return jsonResponse({
      success: false,
      inProgress: true,
      verificationId: plan.activeId,
      retryAfterSeconds: plan.retryAfterSeconds,
      error: 'Devam eden bir kart doğrulaman var. Birkaç dakika sonra tekrar dene.',
    }, 409)
  }
  if (plan.decision === 'limit') {
    return jsonResponse({
      success: false,
      limitReached: true,
      error: 'Bugün en fazla 3 kart doğrulaması yapabilirsin. Yarın tekrar dene.',
    }, 429)
  }

  const inserted = await insertVerification(admin, userId)
  if (!inserted.ok) {
    if (inserted.conflict) {
      return jsonResponse({
        success: false,
        inProgress: true,
        error: 'Devam eden bir kart doğrulaman var. Birkaç dakika sonra tekrar dene.',
      }, 409)
    }
    return jsonResponse({ error: 'İşlem başlatılamadı' }, 500)
  }

  try {
    const { formHtml } = await buildCardVerificationForm({
      sx: SX,
      secretKey: SECRET_KEY,
      vposUrl: VPOS_URL,
      clientRefCode: inserted.clientRefCode,
      amount: verifyToDecimalTL(VERIFICATION_AMOUNT),
      successUrl: `${CALLBACK_URL}?pk=success`,
      failUrl: `${CALLBACK_URL}?pk=fail`,
      rnd: verifyRnd(),
      customerKey,
      cardHolderIP: clientIpFromRequest(req),
      agentCode: AGENT_CODE || undefined,
    })
    // GÜVENLİ LOG: yalnız kayıt kimliği/tutar.
    console.log('[paynkolay-cards] verify_start', { verificationId: inserted.id, amount: verifyToDecimalTL(VERIFICATION_AMOUNT) })
    return jsonResponse({ success: true, verificationId: inserted.id, formHtml })
  } catch (e) {
    console.error('[paynkolay-cards] verify_start form hatası:', (e as Error).message)
    await admin
      .from('card_verifications')
      .update({ status: 'failed', note: 'init_error' })
      .eq('id', inserted.id)
      .eq('status', 'initiated')
    return jsonResponse({ error: 'İşlem başlatılamadı' }, 500)
  }
}

// ── verify_status: kullanıcı YALNIZ kendi kaydını sorgular; yanıt token/kart/
//    referans bilgisi İÇERMEZ (sadece durum, kart_saved, note, refunded).
async function handleVerifyStatus(admin: SupabaseClient, userId: string, body: any): Promise<Response> {
  const id = String(body?.verificationId ?? '')
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) return jsonResponse({ error: 'verificationId zorunlu' }, 400)
  const { data: row } = await admin
    .from('card_verifications')
    .select('status, card_saved, note')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (!row) return jsonResponse({ error: 'Kayıt bulunamadı' }, 404)
  return jsonResponse({ success: true, ...toPublicStatus(row) })
}

// ── verify_cancel: kullanıcı KENDİ açık (initiated) doğrulamasını iptal eder
//    ("İptal et ve yeniden dene"). Kayıt failed/cancelled olur; PARA çekilmiş olabilir
//    (3D tamamlandı ama callback gelmedi / WebView kapatıldı) — bu yüzden 'cancelled'
//    satırlar sweep'in rapor kontrolüne dahildir ve geç gelen callback'te claim
//    'failed' satırı da alır (iade edilmeden kalmaz). Yalnız kendi kaydı; id verilmezse
//    kendi açık kaydı (kullanıcı başına en fazla 1 tane — kısmi unique).
//    Kayıt artık açık değilse (ör. bu arada tamamlandı) durum DEĞİŞTİRİLMEZ, gerçek
//    durum döner ki mobil doğru sonucu göstersin.
async function handleVerifyCancel(admin: SupabaseClient, userId: string, body: any): Promise<Response> {
  const rawId = body?.verificationId
  const id = rawId === undefined || rawId === null || rawId === '' ? null : String(rawId)
  if (id !== null && !/^[0-9a-fA-F-]{36}$/.test(id)) return jsonResponse({ error: 'verificationId geçersiz' }, 400)

  let upd = admin
    .from('card_verifications')
    .update({ status: 'failed', note: 'cancelled' })
    .eq('user_id', userId)
    .eq('status', 'initiated')
  if (id) upd = upd.eq('id', id)
  const { data: cancelledRows, error } = await upd.select('id')
  if (error) {
    console.error('[paynkolay-cards] verify_cancel hatası:', error.message)
    return jsonResponse({ error: 'İşlem tamamlanamadı' }, 500)
  }
  const cancelled = (cancelledRows ?? []).length > 0
  console.log('[paynkolay-cards] verify_cancel', { verificationId: id, cancelled })
  if (cancelled || !id) return jsonResponse({ success: true, cancelled })

  const { data: row } = await admin
    .from('card_verifications')
    .select('status, card_saved, note')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (!row) return jsonResponse({ error: 'Kayıt bulunamadı' }, 404)
  return jsonResponse({ success: true, cancelled: false, ...toPublicStatus(row) })
}

async function handleSetDefault(admin: SupabaseClient, userId: string, body: any): Promise<Response> {
  const cardId = String(body?.cardId ?? '')
  if (!cardId) return jsonResponse({ error: 'cardId zorunlu' }, 400)

  const { data: card } = await admin.from('user_cards').select('id, user_id').eq('id', cardId).maybeSingle()
  if (!card || card.user_id !== userId) return jsonResponse({ error: 'Kart bulunamadı' }, 404)

  const { error: clearErr } = await admin.from('user_cards').update({ is_default: false }).eq('user_id', userId)
  if (clearErr) return jsonResponse({ error: 'Güncelleme başarısız' }, 500)
  const { error: setErr } = await admin.from('user_cards').update({ is_default: true }).eq('id', cardId)
  if (setErr) return jsonResponse({ error: 'Güncelleme başarısız' }, 500)

  return jsonResponse({ success: true })
}

// PaynKolay'da olmayan (yetim) yerel kartları siler; silinen varsayılansa kalanlardan biri varsayılan olur.
async function pruneOrphanCards(
  admin: SupabaseClient,
  userId: string,
  customerKey: string,
  outcome: ListOutcome,
  fetchStartedAtMs: number,
): Promise<number> {
  if (outcome.kind === 'error') return 0
  const { data: cards } = await admin
    .from('user_cards')
    .select('id, paynkolay_customer_key, created_at, is_default')
    .eq('user_id', userId)
  const rows = cards ?? []
  if (rows.length === 0) return 0
  const { data: secrets } = await admin
    .from('user_card_secrets')
    .select('card_id, card_token')
    .in('card_id', rows.map((c: { id: string }) => c.id))
  const tokenById = new Map((secrets ?? []).map((x: { card_id: string; card_token: string }) => [x.card_id, x.card_token]))
  const orphanIds = planOrphans(
    outcome,
    rows.map((c: { id: string; paynkolay_customer_key: string | null; created_at: string }) => ({
      id: c.id,
      token: tokenById.get(c.id) ?? null,
      customerKey: c.paynkolay_customer_key,
      createdAt: c.created_at,
    })),
    customerKey,
    fetchStartedAtMs,
  )
  if (!orphanIds || orphanIds.length === 0) return 0

  const { error } = await admin.from('user_cards').delete().in('id', orphanIds)
  if (error) {
    console.error('[paynkolay-cards] yetim kart silinemedi:', error.message)
    return 0
  }
  console.log('[paynkolay-cards] sync yetim kart temizlendi', { count: orphanIds.length })

  const removedDefault = rows.some((c: { id: string; is_default: boolean }) => c.is_default && orphanIds.includes(c.id))
  if (removedDefault) {
    const { data: next } = await admin
      .from('user_cards')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (next) await admin.from('user_cards').update({ is_default: true }).eq('id', next.id)
  }
  return orphanIds.length
}

async function handleDelete(admin: SupabaseClient, userId: string, body: any): Promise<Response> {
  const cardId = String(body?.cardId ?? '')
  if (!cardId) return jsonResponse({ error: 'cardId zorunlu' }, 400)

  const { data: card } = await admin
    .from('user_cards')
    .select('id, user_id, paynkolay_customer_key, is_default')
    .eq('id', cardId)
    .maybeSingle()
  if (!card || card.user_id !== userId) return jsonResponse({ error: 'Kart bulunamadı' }, 404)

  const { data: secret } = await admin
    .from('user_card_secrets')
    .select('card_token, cs_tran_id')
    .eq('card_id', cardId)
    .maybeSingle()

  if (secret?.card_token) {
    const result = await deleteCardFromPaynkolay({
      vposUrl: VPOS_URL,
      sx: SX,
      secretKey: SECRET_KEY,
      customerKey: String(card.paynkolay_customer_key ?? ''),
      tranId: String(secret.cs_tran_id ?? ''),
      token: String(secret.card_token ?? ''),
    })
    if (!result.ok) {
      // Silme sonucu LİSTEYLE doğrulanır (bkz. paynkolay-card-storage.ts): yerel kayıt YALNIZ
      // "liste geldi ve token yok" iken silinir. Liste alınamadıysa sonuç bilinmiyor → SİLME.
      console.error('[paynkolay-cards] delete doğrulanamadı', { cardId, reason: result.reason })
      return jsonResponse({
        error: result.reason === 'verify_unavailable'
          ? 'Şu an silinemedi, tekrar dene.'
          : 'Kart PaynKolay tarafında silinemedi.',
      }, 502)
    }
  }

  const { error: delErr } = await admin.from('user_cards').delete().eq('id', cardId)
  if (delErr) {
    console.error('[paynkolay-cards] local delete failed:', delErr)
    return jsonResponse({ error: 'Kart silinemedi' }, 500)
  }

  if (card.is_default) {
    const { data: next } = await admin
      .from('user_cards')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (next) {
      await admin.from('user_cards').update({ is_default: true }).eq('id', next.id)
    }
  }

  return jsonResponse({ success: true })
}

// ── pay: Saklı kart ile ödeme al. Tutar sunucuda hesaplanır (client'tan gelen
//    tutara guvenilmez). HER ZAMAN 3D.
async function handlePay(
  req: Request,
  admin: SupabaseClient,
  authedClient: SupabaseClient,
  userId: string,
  body: any,
): Promise<Response> {
  if (!SX || !SECRET_KEY || !PAY_URL) {
    return jsonResponse({ error: 'PaynKolay kart ödeme yapılandırması eksik' }, 500)
  }

  const orderId = body?.orderId ? Number(body.orderId) : NaN
  const cardId = String(body?.cardId ?? '')
  if (!orderId || Number.isNaN(orderId)) return jsonResponse({ error: 'orderId zorunlu' }, 400)
  if (!cardId) return jsonResponse({ error: 'cardId zorunlu' }, 400)

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('id, user_id, total_price, total_amount, phone, merchant_oid, items, subtotal_amount, delivery_fee, discount_amount, macro_discount_amount, coupon_id, coupon_code, type, macro_quantity, status, payment_status, payment_review_pending')
    .eq('id', orderId)
    .maybeSingle()
  if (orderErr || !order) return jsonResponse({ error: 'Sipariş bulunamadı' }, 404)
  if (order.user_id && order.user_id !== userId) return jsonResponse({ error: 'Oturum doğrulanamadı' }, 403)

  // Idempotency: zaten odenmis siparis tekrar tahsil edilmez.
  if (order.payment_status === 'paid') {
    return jsonResponse({ success: true, alreadyPaid: true })
  }

  // Bu siparis icin bir odeme sonucu hala incelemede (needs_manual_review) —
  // yeni bir tahsilat denemesi BASLATILMAZ (cift tahsilat riski).
  if (order.payment_review_pending) {
    return jsonResponse({
      success: false,
      pending: true,
      error: 'Bu siparişin ödemesi hâlâ kontrol ediliyor, lütfen bekleyin.',
    }, 202)
  }

  // Kart: SADECE kendi karti kullanabilir.
  const { data: card } = await admin
    .from('user_cards')
    .select('id, user_id, paynkolay_customer_key')
    .eq('id', cardId)
    .maybeSingle()
  if (!card || card.user_id !== userId) return jsonResponse({ error: 'Kart bulunamadı' }, 404)

  const { data: secret } = await admin
    .from('user_card_secrets')
    .select('card_token, cs_tran_id')
    .eq('card_id', cardId)
    .maybeSingle()
  if (!secret?.card_token && !secret?.cs_tran_id) {
    return jsonResponse({ error: 'Kart bilgisi eksik — lütfen kartı yeniden ekle' }, 400)
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('payment_customer_key')
    .eq('id', userId)
    .maybeSingle()
  const customerKey = String(profile?.payment_customer_key ?? card.paynkolay_customer_key ?? '')
  if (!customerKey) return jsonResponse({ error: 'Müşteri anahtarı bulunamadı' }, 400)

  const amountNum = await recomputeOrderAmount(admin, authedClient, order as OrderRow)
  if (!amountNum || amountNum <= 0) return jsonResponse({ error: 'Sipariş tutarı geçersiz' }, 400)
  const amount = toDecimalTL(amountNum)

  // KCAL{orderId}T... prefix'i callback'in/completePaynkolayResult'in regex'i
  // (/^KCAL(\d+)T/) ile uyumlu kalsin diye korunuyor.
  const clientRefCode = `KCAL${order.id}T${Date.now()}CARD`

  // merchant_oid: callback siparişi CLIENT_REFERENCE_CODE'dan (KCAL{id}T...) eşler,
  // merchant_oid'e BAĞIMLI DEĞİL — ama review-sweep'in rapor sorgusu ve iade akışı
  // buna bakar; init'teki gibi "ilk ref'i sakla, ezme" (sadece boşsa yaz).
  if (!order.merchant_oid) {
    const { error: oidErr } = await admin
      .from('orders')
      .update({ merchant_oid: clientRefCode, payment_provider: 'paynkolay', updated_at: new Date().toISOString() })
      .eq('id', order.id)
    if (oidErr) console.error('[paynkolay-cards] merchant_oid yazılamadı:', oidErr.message)
  }
  const successUrl = `${CALLBACK_URL}?pk=success`
  const failUrl = `${CALLBACK_URL}?pk=fail`
  const rnd = getRnd()
  const cardHolderIP = clientIpFromRequest(req)

  const hashDatav2 = await generatePaynkolayHash([
    SX, clientRefCode, amount, successUrl, failUrl, rnd, customerKey, SECRET_KEY,
  ])

  const form = new FormData()
  form.set('sx', SX)
  form.set('clientRefCode', clientRefCode)
  form.set('successUrl', successUrl)
  form.set('failUrl', failUrl)
  form.set('amount', amount)
  form.set('installmentNo', '1')
  form.set('use3D', 'true')
  form.set('transactionType', 'SALES')
  form.set('rnd', rnd)
  form.set('hashDatav2', hashDatav2)
  form.set('environment', 'API')
  form.set('currencyNumber', CURRENCY_CODE)
  form.set('csCustomerKey', customerKey)
  if (secret.cs_tran_id) form.set('csTranId', String(secret.cs_tran_id))
  if (secret.card_token) form.set('csToken', String(secret.card_token))
  form.set('cardHolderIP', cardHolderIP)

  let httpOk = false
  let httpStatus = 0
  let raw = ''
  try {
    const res = await fetch(PAY_URL, { method: 'POST', body: form })
    httpOk = res.ok
    httpStatus = res.status
    raw = await res.text()
  } catch (e) {
    console.error('[paynkolay-cards] pay fetch error:', e)
    return jsonResponse({ error: 'PaynKolay ödeme servisine erişilemedi' }, 502)
  }

  if (!httpOk) {
    console.error('[paynkolay-cards] pay HTTP', httpStatus)
    return jsonResponse({ error: 'PaynKolay ödeme servisi hata döndürdü', httpStatus }, 502)
  }

  // ── /v1/Payment (use3D=true) yanıtı HAM JSON'dur (USE_3D, BANK_REQUEST_MESSAGE,
  //    REFERENCE_CODE, sessionId...). 3D sayfası JSON'un kendisi değil,
  //    BANK_REQUEST_MESSAGE'ın içindedir — çıkarıp WebView'in render edeceği
  //    HTML'e çeviriyoruz. Ham gövde ASLA istemciye geçmez.
  const parsed = parsePay3DResponse(raw)
  // GÜVENLİ LOG: içerik/token YOK — sadece biçim, anahtar adları, uzunluk.
  console.log('[paynkolay-cards] pay 3D yanıtı', {
    orderId: order.id,
    amount,
    use3D: true,
    kind: parsed.kind,
    format: parsed.format,
    keys: parsed.keys,
    rawLen: raw.length,
  })

  if (parsed.kind === 'error') {
    console.error('[paynkolay-cards] pay 3D yanıtı işlenemedi', {
      orderId: order.id,
      reason: parsed.reason,
      format: parsed.format,
      providerError: parsed.providerError.slice(0, 200),
    })
    try {
      await admin.from('failed_payments').insert([{
        user_id: userId,
        error_message: `Saklı kart 3D yanıtı işlenemedi (${parsed.reason})`,
        amount: 0,
        payment_method: 'kredi-karti-saklı',
        order_data: {
          reason: '3d_response_unusable',
          orderId: order.id,
          clientRefCode,
          format: parsed.format,
          keys: parsed.keys,
          providerError: parsed.providerError.slice(0, 200),
        },
        created_at: new Date().toISOString(),
      }])
    } catch (e) {
      console.error('[paynkolay-cards] failed_payments insert error (3d):', e)
    }
    return jsonResponse({
      success: false,
      error: 'Kayıtlı kartla ödeme başlatılamadı. Lütfen tekrar deneyin ya da yeni kart ile ödeyin.',
    }, 502)
  }

  // 3D: WebView'de render edilir. Sonuç PaynKolay tarafından successUrl/failUrl'e
  // (paynkolay-callback) POST edilir; tamamlama (macro purchase dahil) ORADA olur.
  return jsonResponse({ success: true, requires3D: true, formHtml: parsed.html })
}
