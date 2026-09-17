import { createClient } from '@supabase/supabase-js'
import { buildAppleClientSecret, exchangeAppleAuthorizationCode } from '../_shared/apple-auth.ts'

// Apple native sign-in her başarılı girişte bir authorizationCode döner
// (fullName/email'in aksine — bu HER seferinde gelir). AuthContext.
// signInWithApple bunu her girişte buraya gönderir; biz Apple'ın token
// endpoint'inde refresh_token'a çevirip user_apple_tokens'a (sadece
// service_role okuyabilir) upsert ediyoruz. Bu refresh_token, hesap silme
// akışında Apple'a "bu kullanıcının Apple ile bağlantısını kes" (revoke)
// demek için kullanılacak (App Store 5.1.1(v)).
//
// Best-effort: bu adım başarısız olsa da giriş zaten tamamlanmıştır — hata
// istemciye kritik olarak yansıtılmaz, sadece loglanır.

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

    let body: any = {}
    try {
      const text = await req.text()
      if (text) body = JSON.parse(text)
    } catch { body = {} }

    const authorizationCode = String(body?.authorizationCode ?? '')
    if (!authorizationCode) return jsonResponse({ error: 'authorizationCode zorunlu' }, 400)

    if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY) {
      console.error('[apple-link-token] Apple secret eksik (APPLE_TEAM_ID/APPLE_KEY_ID/APPLE_PRIVATE_KEY)')
      return jsonResponse({ ok: false })
    }

    const clientSecret = await buildAppleClientSecret({
      teamId: APPLE_TEAM_ID,
      keyId: APPLE_KEY_ID,
      clientId: APPLE_CLIENT_ID,
      privateKeyPem: APPLE_PRIVATE_KEY,
    })
    const { refreshToken, error } = await exchangeAppleAuthorizationCode({
      authorizationCode,
      clientId: APPLE_CLIENT_ID,
      clientSecret,
    })
    if (error || !refreshToken) {
      console.error('[apple-link-token] exchange failed:', error)
      return jsonResponse({ ok: false })
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { error: upsertError } = await admin.from('user_apple_tokens').upsert(
      { user_id: user.id, refresh_token: refreshToken, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    if (upsertError) {
      console.error('[apple-link-token] upsert failed:', upsertError.message)
      return jsonResponse({ ok: false })
    }

    return jsonResponse({ ok: true })
  } catch (err) {
    console.error('[apple-link-token] error:', String(err))
    return jsonResponse({ ok: false }, 500)
  }
})
