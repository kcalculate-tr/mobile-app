import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }
    })
  }

  try {
    // Tosla form-urlencoded POST olarak callback gönderir
    const contentType = req.headers.get('content-type') ?? ''
    let params: Record<string, string> = {}

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text()
      const urlParams = new URLSearchParams(text)
      urlParams.forEach((v, k) => { params[k] = v })
    } else {
      // JSON fallback
      params = await req.json()
    }

    console.log('🔔 Tosla Callback:', JSON.stringify(params))

    const orderId          = params['OrderId'] ?? ''
    const bankResponseCode = params['BankResponseCode'] ?? ''
    const bankResponseMsg  = params['BankResponseMessage'] ?? ''
    const transactionId    = params['TransactionId'] ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Siparişi bul — tosla_oid veya id ile
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, order_code, payment_status')
      .or(`tosla_oid.eq.${orderId},id.eq.${orderId}`)
      .maybeSingle()

    if (orderError || !order) {
      console.error('❌ Order not found:', orderId)
      // Tosla'ya 200 dön — aksi halde tekrar dener
      return new Response('OK', { status: 200 })
    }

    // Idempotency — zaten işlendiyse tekrar işleme
    if (order.payment_status === 'paid') {
      console.log('⚠️ Already paid:', order.order_code)
      return new Response('OK', { status: 200 })
    }

    // BankResponseCode 00 = başarılı
    const isSuccess = bankResponseCode === '00'

    if (isSuccess) {
      console.log('✅ Payment success:', order.order_code)
      await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'confirmed',
          tosla_transaction_id: transactionId || null,
          paid_at: new Date().toISOString(),
          payment_error: null,
        })
        .eq('id', order.id)
    } else {
      console.log('❌ Payment failed:', order.order_code, bankResponseCode, bankResponseMsg)
      await supabase
        .from('orders')
        .update({
          payment_status: 'failed',
          tosla_transaction_id: transactionId || null,
          payment_error: `${bankResponseCode}: ${bankResponseMsg}`,
        })
        .eq('id', order.id)

      await supabase
        .from('failed_payments')
        .insert([{
          user_id: order.user_id,
          error_message: bankResponseMsg || 'Ödeme başarısız',
          amount: 0,
          payment_method: 'kredi-karti',
          order_data: params,
          created_at: new Date().toISOString(),
        }])
    }

    // Tosla 200 OK bekler
    return new Response('OK', { status: 200 })

  } catch (error) {
    console.error('❌ Callback error:', error)
    return new Response('OK', { status: 200 })
  }
})
