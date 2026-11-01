// macro-expiry
//
// GUVENLIK NOTU (2026-10-21): Bu fonksiyon verify_jwt=false ile yayindaydi ve
// govdesinde hicbir kimlik kontrolu yoktu (`Deno.serve(async () => {...})`
// istegi tamamen yok sayiyordu). Service role anahtariyla calistigi icin
// internetteki herkes POST atip suresi dolmus uyelerin macro bakiyesini
// sifirlayabiliyordu. Artik yalnizca service_role token'i kabul ediliyor;
// pg_cron isi (macro-expiry-daily) zaten vault'taki service_role_key ile
// cagiriyor, bu yuzden zamanlanmis calisma etkilenmez.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function serviceRoleMu(req: Request): boolean {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return false
  const parcalar = token.split('.')
  if (parcalar.length !== 3) return false
  try {
    const govdeB64 = parcalar[1].replace(/-/g, '+').replace(/_/g, '/')
    const dolgu = govdeB64 + '='.repeat((4 - (govdeB64.length % 4)) % 4)
    const govde = JSON.parse(atob(dolgu)) as { role?: string }
    return govde?.role === 'service_role'
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (!serviceRoleMu(req)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = new Date().toISOString()

  // privileged_until dolmuş kullanıcıları bul ve bakiyeyi sıfırla
  const { data: expired, error } = await supabase
    .from('profiles')
    .select('id, macro_balance, privileged_until')
    .lt('privileged_until', now)
    .gt('macro_balance', 0)

  if (error) return new Response(JSON.stringify({ error }), { status: 500 })

  let updated = 0
  for (const user of (expired ?? [])) {
    await supabase
      .from('profiles')
      .update({
        macro_balance: 0,
        privileged_until: null
      })
      .eq('id', user.id)

    // Transaction kaydet
    await supabase.from('macro_transactions').insert({
      user_id: user.id,
      type: 'expiry',
      amount: -user.macro_balance,
      note: 'Üyelik süresi doldu — macro bakiyesi sıfırlandı',
    })

    updated++
  }

  return new Response(
    JSON.stringify({ processed: expired?.length ?? 0, updated }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
