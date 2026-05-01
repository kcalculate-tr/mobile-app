import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MERCHANT_KEY = Deno.env.get('PAYTR_MERCHANT_KEY') ?? ''
const MERCHANT_SALT = Deno.env.get('PAYTR_MERCHANT_SALT') ?? ''

const FALLBACK_THRESHOLD = 15
const FALLBACK_MEMBERSHIP_DAYS = 30

function okPlain(): Response {
  return new Response('OK', {
    headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
  })
}

async function hmacSha256Base64(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  const bytes = new Uint8Array(sig)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!MERCHANT_KEY || !MERCHANT_SALT) {
      console.error('[paytr-callback] credentials missing')
      return new Response('PAYTR_CONFIG_MISSING', { status: 500 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const data: Record<string, string> = {}
    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      form.forEach((value, key) => { data[key] = String(value) })
    } else {
      const text = await req.text()
      try {
        const parsed = JSON.parse(text)
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) data[k] = String(v)
        }
      } catch {
        const params = new URLSearchParams(text)
        params.forEach((value, key) => { data[key] = value })
      }
    }

    const merchantOid = data.merchant_oid
    const status = data.status
    const totalAmount = data.total_amount
    const hash = data.hash

    if (!merchantOid || !status || !totalAmount || !hash) {
      console.error('[paytr-callback] missing required fields', { hasOid: !!merchantOid, hasStatus: !!status, hasAmt: !!totalAmount, hasHash: !!hash })
      return new Response('MISSING_FIELDS', { status: 400 })
    }

    const computed = await hmacSha256Base64(
      merchantOid + MERCHANT_SALT + status + totalAmount,
      MERCHANT_KEY,
    )

    if (computed !== hash) {
      // PayTR test/spoof istekleri 400 dönerse retry yapar; 200 OK + log ile sonlandır.
      // DB güncellemesi YAPILMIYOR, dolayısıyla güvenlik açığı yok.
      console.error('[paytr-callback] hash mismatch — ignoring', { merchantOid })
      return okPlain()
    }

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, user_id, total_price, type, macro_quantity, status, payment_status')
      .eq('merchant_oid', merchantOid)
      .maybeSingle()

    if (orderErr || !order) {
      console.error('[paytr-callback] order not found for oid', merchantOid, orderErr?.message)
      return okPlain()
    }

    if (order.status === 'confirmed') {
      return okPlain()
    }

    if (status === 'success') {
      const totalAmountNumeric = Number(totalAmount) / 100
      const installmentCount = parseInt(String(data.installment_count ?? '1'), 10) || 1

      console.log('[PAYTR-CALLBACK] success — order status transition', {
        orderId: order.id,
        merchantOid,
        previousStatus: order.status,
        previousPaymentStatus: order.payment_status,
        nextStatus: 'confirmed',
        nextPaymentStatus: 'paid',
        totalAmount: totalAmountNumeric,
      })

      const { error: updErr } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          payment_status: 'paid',
          payment_total_amount: totalAmountNumeric,
          payment_installment_count: installmentCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      if (updErr) {
        console.error('[paytr-callback] order update failed', order.id, updErr)
      }

      if (order.type === 'macro_purchase') {
        try {
          await completeMacroPurchase(supabase, {
            id: order.id,
            user_id: order.user_id,
            total_price: order.total_price,
            type: order.type,
            macro_quantity: order.macro_quantity,
          })
        } catch (macroErr) {
          console.error('[paytr-callback] completeMacroPurchase failed for', order.id, macroErr)
        }
      }
    } else {
      const failureReason =
        data.failed_reason_msg ??
        data.failed_reason_code ??
        'unknown'

      console.log('[PAYTR-CALLBACK] failure — order status transition', {
        orderId: order.id,
        merchantOid,
        previousStatus: order.status,
        previousPaymentStatus: order.payment_status,
        nextStatus: 'payment_failed',
        nextPaymentStatus: 'failed',
        reason: String(failureReason),
      })

      const { error: updErr } = await supabase
        .from('orders')
        .update({
          status: 'payment_failed',
          payment_status: 'failed',
          payment_failure_reason: String(failureReason),
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      if (updErr) {
        console.error('[paytr-callback] failure update error', order.id, updErr)
      }
    }

    return okPlain()
  } catch (err) {
    console.error('[paytr-callback] error:', err)
    return okPlain()
  }
})

type MacroOrder = {
  id: number | string
  user_id: string
  total_price: number | null
  type: string
  macro_quantity: number | null
}

async function completeMacroPurchase(
  supabase: SupabaseClient,
  order: MacroOrder,
): Promise<void> {
  const macroQty = Number(order.macro_quantity ?? 0)
  if (!macroQty || macroQty <= 0) {
    console.warn('[macro] macro_purchase order without macro_quantity', order.id)
    return
  }
  if (!order.user_id) {
    console.warn('[macro] macro_purchase order without user_id', order.id)
    return
  }

  const { data: settings } = await supabase
    .from('settings')
    .select('macro_threshold, macro_membership_days')
    .eq('id', 1)
    .maybeSingle()

  const threshold = Number(settings?.macro_threshold ?? FALLBACK_THRESHOLD)
  const membershipDays = Number(settings?.macro_membership_days ?? FALLBACK_MEMBERSHIP_DAYS)

  const { data: profile, error: profileErr } = await supabase
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

  const { error: updateErr } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', order.user_id)

  if (updateErr) {
    console.error('[macro] profile update failed for order', order.id, updateErr)
    return
  }

  await supabase.from('macro_transactions').insert({
    user_id: order.user_id,
    type: 'purchase',
    amount: macroQty,
    price_paid: Number(order.total_price ?? 0),
    order_id: typeof order.id === 'number' ? order.id : Number(order.id),
    note: `${macroQty} Macro Coin satın alındı`,
  })

  if (unlockedMembership) {
    await supabase.from('macro_transactions').insert({
      user_id: order.user_id,
      type: 'membership_unlock',
      amount: 0,
      note: `Ayrıcalıklı üyelik aktifleşti — ${membershipDays} gün`,
    })
  }
}
