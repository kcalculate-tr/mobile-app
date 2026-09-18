import { createClient } from '@supabase/supabase-js'
import { buildAppleClientSecret, revokeAppleRefreshToken } from '../_shared/apple-auth.ts'
import { deleteCardFromPaynkolay } from '../_shared/paynkolay-cards.ts'

// Hesap silme (App Store 5.1.1(v)) — SecurityScreen "Hesabımı Sil" tarafından
// çağrılır. Kullanıcı SADECE kendi hesabını silebilir (auth.uid() ile alınan
// kullanıcı, body'den bir id ALINMAZ).
//
// Sıra:
//  0) Gerçekten süren bir sipariş varsa (pending/confirmed/preparing/on_way,
//     veya payment_review_pending=true, veya pending_payment VE 1 saatten
//     TAZE) reddedilir. delivered/cancelled/refunded/expired/payment_failed
//     ENGELLEMEZ. 1 saatten ESKİ pending_payment taslakları (ödeme hiç
//     başlamamış/tamamlanmamış zombi kayıtlar) engel SAYILMAZ — silme
//     sırasında 'cancelled' yapılıp temizlenir.
//  1) Silinme öncesi profiles.phone + auth.users.phone + kullanıcının TÜM
//     siparişlerindeki phone değerleri (normalize, son 10 hane, tekrarsız)
//     — her biri için AYRI bir deleted_account_fingerprints satırı; e-posta
//     için de ayrıca bir satır. validate_coupon first_order_only kontrolü
//     buna bakar — orders anonimleştirmesi bu izi SİLMEZ.
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

const BLOCKING_ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'on_way']
const STALE_DRAFT_MS = 60 * 60 * 1000 // 1 saat

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
    if (!authHeader) return jsonResponse({ error: 'Oturum doğrulanamadı' }, 401)

    const authedClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await authedClient.auth.getUser()
    if (authError || !user) return jsonResponse({ error: 'Oturum doğrulanamadı' }, 401)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const userId = user.id

    // 0) Gerçekten süren sipariş kontrolü (+ eski pending_payment taslaklarını
    //    tespit et — engel değiller, ama aşağıda 'cancelled' yapılacaklar).
    const { data: userOrders, error: ordersErr } = await admin
      .from('orders')
      .select('id, status, payment_review_pending, created_at, phone')
      .eq('user_id', userId)
    if (ordersErr) {
      console.error('[delete-account] order fetch failed:', ordersErr.message)
      return jsonResponse({ error: 'Hesap silinemedi, lütfen tekrar deneyin.' }, 500)
    }

    const now = Date.now()
    const staleDraftIds: number[] = []
    const hasBlocking = (userOrders ?? []).some((o) => {
      if (BLOCKING_ACTIVE_STATUSES.includes(o.status)) return true
      if (o.payment_review_pending) return true
      if (o.status === 'pending_payment') {
        const ageMs = now - new Date(o.created_at).getTime()
        if (ageMs < STALE_DRAFT_MS) return true
        staleDraftIds.push(o.id)
      }
      return false
    })

    if (hasBlocking) {
      // 200 ile döner (409 DEĞİL): supabase-js functions.invoke() non-2xx
      // yanıtlarda body'yi PARSE ETMEZ (data:null, error:FunctionsHttpError,
      // ham Response error.context'te) — istemci sadece 200 + {ok:false,
      // error} ile bu özel mesajı gösterebilir.
      return jsonResponse({ ok: false, error: 'Aktif siparişin tamamlandıktan sonra hesabını silebilirsin.' })
    }

    if (staleDraftIds.length > 0) {
      const { error: staleErr } = await admin
        .from('orders')
        .update({ status: 'cancelled' })
        .in('id', staleDraftIds)
      if (staleErr) console.error('[delete-account] stale draft cancel failed:', staleErr.message)
    }

    // 1) Silinen-hesap izi (fingerprint) — orders anonimleştirmesinden
    //    ETKİLENMEZ, tekrar kayıt olup aynı telefon/e-posta ile ilk-sipariş
    //    kuponunu tekrar kullanmayı engeller. Her ayrı telefon için AYRI satır
    //    (profil, auth.users, ve TÜM siparişlerdeki telefonlar) + e-posta için
    //    bir satır daha.
    try {
      const { data: profile } = await admin
        .from('profiles')
        .select('phone')
        .eq('id', userId)
        .maybeSingle()
      const rawPhones = [
        profile?.phone,
        user.phone,
        ...(userOrders ?? []).map((o) => o.phone),
      ]
      const normalizedPhones = Array.from(
        new Set(
          rawPhones
            .map((p) => String(p ?? '').replace(/\D/g, '').slice(-10))
            .filter((p) => p.length > 0),
        ),
      )
      const emailNorm = String(user.email ?? '').trim().toLowerCase()

      for (const phoneNorm of normalizedPhones) {
        await admin.from('deleted_account_fingerprints').insert({ phone_hash: await sha256Hex(phoneNorm) })
      }
      if (emailNorm) {
        await admin.from('deleted_account_fingerprints').insert({ email_hash: await sha256Hex(emailNorm) })
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
          console.error(`[delete-account] paynkolay card delete doğrulanamadı for card ${card.id}:`, result.reason)
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
