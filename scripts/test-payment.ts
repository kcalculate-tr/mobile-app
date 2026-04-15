import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!
)

async function testPayment() {
  // Login
  const { data: { session }, error } = await supabase.auth.signInWithPassword({
    email: 'TEST_EMAIL_BURAYA',
    password: 'TEST_PASSWORD_BURAYA'
  })

  if (error || !session) {
    console.error('Login failed:', error)
    return
  }

  console.log('✅ Login OK, token alındı')

  // payment-init test
  const res = await fetch(
    'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/payment-init',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': process.env.EXPO_PUBLIC_SUPABASE_KEY!
      },
      body: JSON.stringify({ orderId: 999, amount: 150.00 })
    }
  )

  const data = await res.json()
  console.log('Payment init response:', JSON.stringify(data, null, 2))
}

testPayment()
