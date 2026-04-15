import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let data: any = {}
    let bankResponseCode = ''
    let mdStatus = ''

    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('application/json')) {
      try {
        const text = await req.text()
        if (text) data = JSON.parse(text)
      } catch { data = {} }
      bankResponseCode = String(data.BankResponseCode ?? data.bankResponseCode ?? '')
      mdStatus = String(data.MdStatus ?? data.mdStatus ?? '')
    } else {
      // Form-data (Tosla'nın gönderdiği callback formatı)
      const formData = await req.formData()
      formData.forEach((value, key) => { data[key] = value })
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

    if (orderId) {
      const { error } = await supabase
        .from('orders')
        .update({
          status: isSuccess ? 'confirmed' : 'payment_failed',
          payment_status: isSuccess ? 'paid' : 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)

      if (error) {
        console.error('Order update error:', error)
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
