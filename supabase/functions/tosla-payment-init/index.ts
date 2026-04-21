import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts"
import { encode as base64Encode } from "https://deno.land/std@0.68.0/encoding/base64.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function createHash(apiPass: string, clientId: string, apiUser: string, rnd: string, timeSpan: string): Promise<string> {
  const hashString = apiPass + clientId + apiUser + rnd + timeSpan
  const encoder = new TextEncoder()
  const data = encoder.encode(hashString)
  const hashBuffer = await crypto.subtle.digest('SHA-512', data)
  return base64Encode(new Uint8Array(hashBuffer))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { amount, orderId } = await req.json()

    const CLIENT_ID = Deno.env.get('TOSLA_CLIENT_ID') ?? ''
    const API_USER  = Deno.env.get('TOSLA_API_USER') ?? ''
    const API_PASS  = Deno.env.get('TOSLA_API_PASS') ?? ''
    const BASE_URL  = Deno.env.get('TOSLA_BASE_URL') ?? 'https://prepentegrasyon.tosla.com/api/Payment/'
    const CALLBACK_URL = Deno.env.get('TOSLA_CALLBACK_URL') ?? ''

    // GMT+3 timeSpan
    const now = new Date()
    const tr = new Date(now.getTime() + 3 * 60 * 60 * 1000)
    const timeSpan = tr.toISOString().replace(/[-T:]/g, '').slice(0, 14)

    // Random string
    const rnd = Math.floor(Math.random() * 1000000).toString()

    // Hash
    const hash = await createHash(API_PASS, CLIENT_ID, API_USER, rnd, timeSpan)

    // Amount: kuruş cinsinden (1 TL = 100)
    const amountInKurus = Math.round(amount * 100)

    const payload = {
      ClientId: parseInt(CLIENT_ID),
      ApiUser: API_USER,
      Rnd: rnd,
      TimeSpan: timeSpan,
      Hash: hash,
      CallbackUrl: CALLBACK_URL,
      OrderId: orderId,
      Amount: amountInKurus,
      Currency: 949,
      InstallmentCount: 0,
    }

    const res = await fetch(`${BASE_URL}threeDPayment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (data.Code !== 0) {
      return new Response(JSON.stringify({ error: data.Message, code: data.Code }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    return new Response(JSON.stringify({
      success: true,
      threeDSessionId: data.ThreeDSessionId,
      transactionId: data.TransactionId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
    })
  }
})
