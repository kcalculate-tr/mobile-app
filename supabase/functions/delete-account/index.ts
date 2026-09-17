import { createClient } from '@supabase/supabase-js'
import { buildAppleClientSecret, revokeAppleRefreshToken } from '../_shared/apple-auth.ts'
import { deleteCardFromPaynkolay } from '../_shared/paynkolay-cards.ts'

// Hesap silme (App Store 5.1.1(v)) — SecurityScreen "Hesabımı Sil" tarafından
// çağrılır. Kullanıcı SADECE kendi hesabını silebilir (auth.uid() ile alınan
// kullanıcı, body'den bir id ALINMAZ).
//
// Sıra:
//  0) Aktif siparişi varsa (delivered/cancelled/refunded DIŞINDA herhangi bir
//     durum) reddedilir — hem "hesap silindi ama teslimat/mutfak süreci
//     ortada kaldı" operasyonel riskini, hem de "sil, tekrar kayıt ol"
//     yoluyla kupon/limit atlatmayı önler.
//  1) Silinme öncesi profiles.phone + auth email normalize edilip hash'lenir,
//     deleted_account_fingerprints'e yazılır (validate_coupon first_order_only
//     kontrolü buna bakar — orders anonimleştirmesi bu izi SİLMEZ).
//  2) Apple ile bağlanmışsa (user_apple_tokens'ta refresh_token varsa) Apple'a
//     revoke isteği — best-effort, başarısız olsa da silme durmaz.
//  3) Saklı kart varsa PaynKolay'dan da silinir (best-effort — başarısız olsa
//     da lokal kayıt CASCADE ile zaten silinecek, sadece loglanır).
//  4) orders: user_id/address_id/customer_id NULL + kişisel alanlar maskelenir
//     (KAYIT SİLİNMEZ — yasal saklama/muhasebe delili gereksinimi).
//  5) user_apple_tokens satırı temizlenir.
//  6) auth.admin.deleteUser() — profiles/addresses/user_nutrition_profiles/
//     branch_users/push_tokens/user_cards/... CASCADE ile gider.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const APPLE_TEAM_ID = (Deno.env.get('APPLE_TEAM_ID') ?? '').trim()
const APPLE_KEY_ID = (Deno.env.get('APPLE_KEY_ID') ?? '').trim()
const APPLE_PRIVATE_KEY = Deno.env.get('APPLE_PRIVATE_KEY') ?? ''
const APPLE_CLIENT_ID = (Deno.env.get('APPLE_CLIENT_ID') ?? 'com.kcalmobile.app').trim()
const PAYNKOLAY_SX = (Deno.env.get('PAYNKOLAY_SX') ?? '').trim()
const PAYNKOLAY_SECRET_KEY = (Deno.env.get('PAYNKOLAY_SECRET_KEY') ?? '').trim()
const PAYNKOLAY_VPOS_URL = (Deno.env.get('PAYNKOLAY_VPOS_URL') ?? '').trim()

const ACTIVE_STATUSES_EXCLUDED = ['delivered', 'cancelled', 'refunded']

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

    const authedClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await authedClient.auth.getUser()
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const userId = user.id

    // 0) Aktif sipariş kontrolü.
    const { data: activeOrders, error: activeErr } = await admin
      .from('orders')
      .select('id')
      .eq('user_id', userId)
      .not('status', 'in', `(${ACTIVE_STATUSES_EXCLUDED.join(',')})`)
      .limit(1)
    if (activeErr) {
      console.error('[delete-account] active order check failed:', activeErr.message)
      return jsonResponse({ error: 'Hesap silinemedi, lütfen tekrar deneyin.' }, 500)
    }
    if (activeOrders && activeOrders.length > 0) {
      // 200 ile döner (409 DEĞİL): supabase-js functions.invoke() non-2xx
      // yanıtlarda body'yi PARSE ETMEZ (data:null, error:FunctionsHttpError,
      // ham Response error.context'te) — istemci sadece 200 + {ok:false,
      // error} ile bu özel mesajı gösterebilir.
      return jsonResponse({ ok: false, error: 'Aktif siparişin tamamlandıktan sonra hesabını silebilirsin.' })
    }

    // 1) Silinen-hesap izi (fingerprint) — orders anonimleştirmesinden
    //    ETKİLENMEZ, tekrar kayıt olup aynı telefon/e-posta ile ilk-sipariş
    //    kuponunu tekrar kullanmayı engeller.
    try {
      const { data: profile } = await admin
        .from('profiles')
        .select('phone')
        .eq('id', userId)
        .maybeSingle()
      const phoneNorm = String(profile?.phone ?? '').replace(/\D/g, '').slice(-10)
      const emailNorm = String(user.email ?? '').trim().toLowerCase()
      if (phoneNorm || emailNorm) {
        await admin.from('deleted_account_fingerprints').insert({
          phone_hash: phoneNorm ? await sha256Hex(phoneNorm) : null,
          email_hash: emailNorm ? await sha256Hex(emailNorm) : null,
        })
      }
    } catch (e) {
      console.error('[delete-account] fingerprint step error:', String(e))
    }

    // 2) Apple token iptali — best-effort.
    try {
      const { data: appleRow } = await admin
        .from('user_apple_tokens')
        .select('refresh_token')
        .eq('user_id', userId)
        .maybeSingle()
      if (appleRow?.refresh_token && APPLE_TEAM_ID && APPLE_KEY_ID && APPLE_PRIVATE_KEY) {
        const clientSecret = await buildAppleClientSecret({
          teamId: APPLE_TEAM_ID,
          keyId: APPLE_KEY_ID,
          clientId: APPLE_CLIENT_ID,
          privateKeyPem: APPLE_PRIVATE_KEY,
        })
        const revoke = await revokeAppleRefreshToken({
          refreshToken: appleRow.refresh_token,
          clientId: APPLE_CLIENT_ID,
          clientSecret,
        })
        if (!revoke.ok) console.error('[delete-account] apple revoke failed:', revoke.error)
      }
    } catch (e) {
      console.error('[delete-account] apple revoke step error:', String(e))
    }

    // 3) Saklı kart(lar) — PaynKolay'dan sil (best-effort, hesap silmeyi
    //    durdurmaz; lokal kayıt zaten CASCADE ile gidecek).
    try {
      const { data: cards } = await admin
        .from('user_cards')
        .select('id, paynkolay_customer_key')
        .eq('user_id', userId)
      for (const card of cards ?? []) {
        const { data: secret } = await admin
          .from('user_card_secrets')
          .select('card_token, cs_tran_id')
          .eq('card_id', card.id)
          .maybeSingle()
        if (!secret?.card_token) continue
        const result = await deleteCardFromPaynkolay({
          vposUrl: PAYNKOLAY_VPOS_URL,
          sx: PAYNKOLAY_SX,
          secretKey: PAYNKOLAY_SECRET_KEY,
          customerKey: String(card.paynkolay_customer_key ?? ''),
          tranId: String(secret.cs_tran_id ?? ''),
          token: String(secret.card_token ?? ''),
        })
        if (!result.ok) {
          console.error(`[delete-account] paynkolay card delete failed for card ${card.id}:`, result.error)
        }
      }
    } catch (e) {
      console.error('[delete-account] card delete step error:', String(e))
    }

    // 4) Siparişleri anonimleştir (kayıt kalır, kişi kalkar).
    const { error: anonError } = await admin
      .from('orders')
      .update({
        user_id: null,
        address_id: null,
        customer_id: null,
        customer_name: 'Silinen Kullanıcı',
        customer_email: null,
        phone: null,
        address: null,
        note: null,
      })
      .eq('user_id', userId)
    if (anonError) {
      console.error('[delete-account] orders anonymize failed:', anonError.message)
      return jsonResponse({ error: 'Sipariş geçmişi anonimleştirilemedi, lütfen tekrar deneyin.' }, 500)
    }

    // 5) Apple token kaydını temizle.
    await admin.from('user_apple_tokens').delete().eq('user_id', userId)

    // 6) auth.users silinir — CASCADE ile profiles/addresses/user_nutrition_
    //    profiles/branch_users/push_tokens/user_cards/... gider.
    const { error: delErr } = await admin.auth.admin.deleteUser(userId)
    if (delErr) {
      console.error('[delete-account] deleteUser failed:', delErr.message)
      return jsonResponse({ error: 'Hesap silinemedi, lütfen destek ile iletişime geçin.' }, 500)
    }

    return jsonResponse({ ok: true })
  } catch (err) {
    console.error('[delete-account] error:', String(err))
    return jsonResponse({ error: 'Hesap silinemedi' }, 500)
  }
})
