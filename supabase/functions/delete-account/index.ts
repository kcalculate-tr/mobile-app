import { createClient } from '@supabase/supabase-js'
import { buildAppleClientSecret, revokeAppleRefreshToken } from '../_shared/apple-auth.ts'

// Hesap silme (App Store 5.1.1(v)) — SecurityScreen "Hesabımı Sil" tarafından
// çağrılır. Kullanıcı SADECE kendi hesabını silebilir (auth.uid() ile alınan
// kullanıcı, body'den bir id ALINMAZ).
//
// Sıra:
//  1) Apple ile bağlanmışsa (user_apple_tokens'ta refresh_token varsa) Apple'a
//     revoke isteği — best-effort, başarısız olsa da silme durmaz.
//  2) Saklı kart notu: PaynKolay kart-saklama entegrasyonu şu an ayrı, kapalı
//     bir özellik (CARD_STORAGE yetkisi PaynKolay'dan hâlâ bekleniyor) — o
//     koda BURADAN dokunulmuyor; sadece varlığı loglanır (bugün pratikte
//     imkansız: gerçek kart kaydı hiç oluşamıyor).
//  3) orders: user_id NULL + kişisel alanlar maskelenir (KAYIT SİLİNMEZ —
//     yasal saklama/muhasebe delili gereksinimi, KVKK madde 6 sözleşmesi).
//  4) user_apple_tokens satırı temizlenir.
//  5) auth.admin.deleteUser() — profiles/addresses/user_nutrition_profiles/
//     branch_users/push_tokens/user_cards/... CASCADE ile gider.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const APPLE_TEAM_ID = (Deno.env.get('APPLE_TEAM_ID') ?? '').trim()
const APPLE_KEY_ID = (Deno.env.get('APPLE_KEY_ID') ?? '').trim()
const APPLE_PRIVATE_KEY = Deno.env.get('APPLE_PRIVATE_KEY') ?? ''
const APPLE_CLIENT_ID = (Deno.env.get('APPLE_CLIENT_ID') ?? 'com.kcalmobile.app').trim()

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

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

    // 1) Apple token iptali — best-effort.
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

    // 2) Saklı kart — bilinçli olarak dokunulmuyor (yukarıdaki not).
    const { data: cards } = await admin.from('user_cards').select('id').eq('user_id', userId)
    if (cards && cards.length > 0) {
      console.warn(
        `[delete-account] user ${userId} has ${cards.length} saved card row(s) — PaynKolay-side deletion is not wired here, manual check may be needed`,
      )
    }

    // 3) Siparişleri anonimleştir (kayıt kalır, kişi kalkar).
    const { error: anonError } = await admin
      .from('orders')
      .update({
        user_id: null,
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

    // 4) Apple token kaydını temizle.
    await admin.from('user_apple_tokens').delete().eq('user_id', userId)

    // 5) auth.users silinir — CASCADE ile profiles/addresses/user_nutrition_
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
