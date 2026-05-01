// Tosla-specific callback handler. PayTR uses paytr-callback (separate endpoint).
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FALLBACK_THRESHOLD = 15
const FALLBACK_MEMBERSHIP_DAYS = 30

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    let data: any = {}
    let bankResponseCode = ''
    let mdStatus = ''

    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('application/json')) {
      try {
        const text = await req.text()
        if (text) data = JSON.parse(text)
      } catch {
        data = {}
      }
      bankResponseCode = String(data.BankResponseCode ?? data.bankResponseCode ?? '')
      mdStatus = String(data.MdStatus ?? data.mdStatus ?? '')
    } else {
      // Form-data (Tosla'nın gönderdiği callback formatı)
      const formData = await req.formData()
      formData.forEach((value, key) => {
        data[key] = value
      })
      bankResponseCode = String(data.BankResponseCode ?? '')
      mdStatus = String(data.MdStatus ?? '')
    }

    const rawOrderId = data.OrderId ?? data.orderId
    const orderId = rawOrderId ? parseInt(String(rawOrderId), 10) : null

    if (!orderId || isNaN(orderId)) {
      console.log('Test order, DB güncellenmedi. Raw orderId:', rawOrderId)
      return new Response('OK', { status: 200 })
    }

    // Tosla: BankResponseCode "00" VEYA MdStatus "1" başarı anlamına gelir
    const isSuccess = bankResponseCode === '00' || mdStatus === '1'

    // Order'ı type + macro_quantity ile birlikte çek (macro_purchase branch için).
    const { data: order, error: orderFetchErr } = await supabase
      .from('orders')
      .select('id, user_id, total_price, type, macro_quantity, status')
      .eq('id', orderId)
      .maybeSingle()

    if (orderFetchErr) {
      console.error('Order fetch error:', orderFetchErr)
    }

    // Status + payment_status güncelle
    console.log('[PAYMENT-VERIFY] order status transition', {
      orderId,
      isSuccess,
      bankResponseCode,
      mdStatus,
      previousStatus: order?.status ?? null,
      nextStatus: isSuccess ? 'confirmed' : 'payment_failed',
      nextPaymentStatus: isSuccess ? 'paid' : 'failed',
    })
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: isSuccess ? 'confirmed' : 'payment_failed',
        payment_status: isSuccess ? 'paid' : 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('Order update error:', updateError)
    }

    // Macro purchase tamamlama — ödeme başarılıysa VE order bir macro alımı ise.
    // Idempotency: order.status === 'confirmed' zaten ise tekrar macro credit ETME.
    if (isSuccess && order && order.type === 'macro_purchase' && order.status !== 'confirmed') {
      try {
        await completeMacroPurchase(supabase, order)
      } catch (macroErr) {
        // Ödeme zaten geçti, rollback yok. Manuel müdahale için log.
        console.error('[macro] completeMacroPurchase FAILED for order', order.id, macroErr)
      }
    }

    // Tosla callback'e 'OK' dönmek bekleniyor
    return new Response('OK', {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    })
  } catch (err) {
    console.error('payment-verify error:', err)
    return new Response('OK', {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    })
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

  // Settings — admin değiştirebilir, fallback var
  const { data: settings } = await supabase
    .from('settings')
    .select('macro_threshold, macro_membership_days')
    .eq('id', 1)
    .maybeSingle()

  const threshold = Number(settings?.macro_threshold ?? FALLBACK_THRESHOLD)
  const membershipDays = Number(settings?.macro_membership_days ?? FALLBACK_MEMBERSHIP_DAYS)

  // Profile mevcut durumu
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

  // Üyelik kontrolü — balance threshold'a ulaştıysa
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

  // Audit: purchase
  await supabase.from('macro_transactions').insert({
    user_id: order.user_id,
    type: 'purchase',
    amount: macroQty,
    price_paid: Number(order.total_price ?? 0),
    order_id: typeof order.id === 'number' ? order.id : Number(order.id),
    note: `${macroQty} Macro Coin satın alındı`,
  })

  // Audit: membership unlock
  if (unlockedMembership) {
    await supabase.from('macro_transactions').insert({
      user_id: order.user_id,
      type: 'membership_unlock',
      amount: 0,
      note: `Ayrıcalıklı üyelik aktifleşti — ${membershipDays} gün`,
    })
  }
}
