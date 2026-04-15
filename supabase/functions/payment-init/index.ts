import { createClient } from '@supabase/supabase-js'

const TOSLA_API_URL = 'https://prepentegrasyon.tosla.com/api/Payment'
const CLIENT_ID = Deno.env.get('TOSLA_CLIENT_ID') ?? '1000000494'
const API_USER = Deno.env.get('TOSLA_API_USER') ?? ''
const API_PASS = Deno.env.get('TOSLA_API_PASS') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Hash üretimi: SHA512(ApiPass + ClientId + ApiUser + Rnd + TimeSpan)
async function generateHash(rnd: string, timeSpan: string): Promise<string> {
  const hashString = API_PASS + CLIENT_ID + API_USER + rnd + timeSpan
  const encoder = new TextEncoder()
  const data = encoder.encode(hashString)
  const hashBuffer = await crypto.subtle.digest('SHA-512', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashBinary = hashArray.map(b => String.fromCharCode(b)).join('')
  return btoa(hashBinary)
}

// TimeSpan: yyyyMMddHHmmss formatında GMT+3
function getTimeSpan(): string {
  const now = new Date()
  const tr = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${tr.getUTCFullYear()}${pad(tr.getUTCMonth()+1)}${pad(tr.getUTCDate())}${pad(tr.getUTCHours())}${pad(tr.getUTCMinutes())}${pad(tr.getUTCSeconds())}`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let body: any = {}
    try {
      const text = await req.text()
      if (text) body = JSON.parse(text)
    } catch { body = {} }

    const { orderId, amount, callbackUrl } = body
    const authHeader = req.headers.get('Authorization')

    // Auth kontrolü (TEST_BYPASS veya gerçek session)
    if (authHeader !== 'Bearer TEST_BYPASS') {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Gerçek Supabase session doğrula
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      )
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized', detail: authError?.message }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    if (!orderId || !amount) {
      return new Response(JSON.stringify({ error: 'orderId ve amount zorunlu' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Tosla amount formatı: son iki hane kuruş (150 TL = 15000)
    const toslaAmount = Math.round(Number(amount) * 100)

    const rnd = Math.floor(Math.random() * 1000000).toString()
    const timeSpan = getTimeSpan()
    const hash = await generateHash(rnd, timeSpan)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const cbUrl = callbackUrl ?? `${supabaseUrl}/functions/v1/payment-verify`
    console.log('Payment init:', { orderId, amount, callbackUrl: cbUrl })

    // threeDPayment isteği
    const paymentRes = await fetch(`${TOSLA_API_URL}/threeDPayment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: Number(CLIENT_ID),
        apiUser: API_USER,
        rnd,
        timeSpan,
        hash,
        orderId: String(orderId),
        amount: toslaAmount,
        currency: 949,
        installmentCount: 0,
        callbackUrl: cbUrl,
      })
    })

    const paymentText = await paymentRes.text()
    let paymentData: any = {}
    try { paymentData = JSON.parse(paymentText) } catch { paymentData = { raw: paymentText } }

    if (paymentData.Code !== 0) {
      return new Response(JSON.stringify({
        error: 'Tosla ödeme başlatılamadı',
        detail: paymentData,
        debug: { rnd, timeSpan, toslaAmount }
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Ortak ödeme sayfası URL'i
    const threeDSessionId = paymentData.ThreeDSessionId
    const paymentUrl = `${TOSLA_API_URL}/threeDSecure/${threeDSessionId}`

    return new Response(JSON.stringify({
      success: true,
      threeDSessionId,
      paymentUrl,
      orderId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
