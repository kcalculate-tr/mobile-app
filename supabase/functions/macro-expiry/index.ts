import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
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
