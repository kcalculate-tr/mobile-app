// tosla-payment-init
//
// GUVENLIK NOTU (2026-10-21): Bu fonksiyon verify_jwt=false ile yayindaydi ve
// govdesinde hicbir kimlik kontrolu yoktu. Disaridan bos bir JSON govdesiyle
// POST atmak bile GERCEK bir Tosla 3D odeme oturumu aciyordu (canli olarak
// dogrulandi: threeDSessionId + transactionId donuyordu). Yani internetteki
// herkes KCAL'in uye isyeri hesabi uzerinden sinirsiz odeme oturumu
// uretebiliyordu. Artik gecerli bir kullanici oturumu zorunlu.
//
// Tosla, Paynkolay'da sorun olursa devreye alinacak yedek altyapi olarak
// bilerek tutuluyor; islev korundu, yalnizca kimlik dogrulamasi eklendi.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts"
import { encode as base64Encode } from "https://deno.land/std@0.68.0/encoding/base64.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

// Cagiran gercek bir kullanici mi? (service_role sunucu ici cagrilara izin verir)
async function kimlikDogrula(req: Request): Promise<{ ok: boolean; userId?: string }> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return { ok: false }

  const parcalar = token.split('.')
  if (parcalar.length === 3) {
    try {
      const govdeB64 = parcalar[1].replace(/-/g, '+').replace(/_/g, '/')
      const dolgu = govdeB64 + '='.repeat((4 - (govdeB64.length % 4)) % 4)
      const govde = JSON.parse(atob(dolgu)) as { role?: string }
      if (govde?.role === 'service_role') return { ok: true }
    } catch { /* kullanici token'i olarak asagida dogrulanir */ }
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const { data, error } = await admin.auth.getUser(token)
    if (error || !data?.user) return { ok: false }
    return { ok: true, userId: data.user.id }
  } catch {
    return { ok: false }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const kimlik = await kimlikDogrula(req)
  if (!kimlik.ok) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
    })
  }

  try {
    const { amount, orderId } = await req.json()

    // Govde dogrulamasi: eskiden bos govde bile oturum aciyordu
    const tutar = Number(amount)
    if (!Number.isFinite(tutar) || tutar <= 0) {
      return new Response(JSON.stringify({ error: 'invalid_amount' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'missing_order_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

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
    const amountInKurus = Math.round(tutar * 100)

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
