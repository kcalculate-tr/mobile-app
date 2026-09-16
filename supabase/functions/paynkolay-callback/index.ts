// Paynkolay callback handler (successUrl/failUrl). Tosla = payment-verify,
// PayTR = paytr-callback (ayri endpoint'ler).
//
// EN KRITIK FARK (Tosla'da YOKTU): RESPONSE HASH DOGRULAMA.
// Paynkolay form-data POST atar; gelen verinin GERCEKTEN Paynkolay'dan geldigini
// hash ile dogrulariz. Hash tutmazsa order'a DOKUNULMAZ, sahte callback olarak
// reddedilir. Bu, saldirganin sahte "basarili odeme" callback'i gondermesini onler.
//
// Odeme sonucu tamamlama mantigi (hash dogrulama, basari kurali, order update,
// kart saklama, macro purchase) _shared/paynkolay-cards.ts::completePaynkolayResult
// icinde — paynkolay-cards (pay, non-3D) ile PAYLASILIR. Degisiklik gerekiyorsa
// ORADAN yapilmali (burada kopyalanmaz).
import { createClient } from '@supabase/supabase-js'
import { completePaynkolayResult, pick } from '../_shared/paynkolay-cards.ts'

const SECRET_KEY = (Deno.env.get('PAYNKOLAY_SECRET_KEY') ?? '').trim()
const SX = (Deno.env.get('PAYNKOLAY_SX') ?? '').trim()
const VPOS_URL = (Deno.env.get('PAYNKOLAY_VPOS_URL') ?? '').trim()

// Mobil WebView'in onNavigationStateChange ile yakalayacagi son URL'ler.
// Mobil (Faz 2E) bu URL'lerde 'result=success' / 'result=fail' arayacak.
const SUCCESS_REDIRECT = 'https://eatkcal.com/payment/success?result=success'
const FAIL_REDIRECT = 'https://eatkcal.com/payment/fail?result=fail'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mobil WebView'in yakalayacagi son URL'e yonlendiren basit HTML.
function redirectHtml(url: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<meta http-equiv="refresh" content="0;url=${url}" /></head>
<body><script>location.replace(${JSON.stringify(url)});</script></body></html>`
}
function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // ── Form-data (Paynkolay) / JSON parse (payment-verify deseni).
    let data: Record<string, unknown> = {}
    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      try {
        const text = await req.text()
        if (text) data = JSON.parse(text)
      } catch { data = {} }
    } else {
      const formData = await req.formData()
      formData.forEach((value, key) => { data[key] = value })
    }

    // TESHIS: PaynKolay'in bu istekte GERCEKTEN hangi alan adlarini gonderdigini
    // gor — degerler ASLA loglanmaz, sadece anahtar (key) adlari.
    console.log('[paynkolay-callback] incoming field names:', Object.keys(data))

    // ── Alanlari cek (UPPER_CASE + camelCase tolerans). TRAN_ID: hosted donuste
    //    Token YOK, sadece TRAN_ID var (2026-09-16 canli testte dogrulandi) —
    //    kart-kaydetme tetikleyicisi artik bu.
    const result = await completePaynkolayResult(
      supabase,
      {
        merchantNo: pick(data, 'MERCHANT_NO', 'merchantNo'),
        referenceCode: pick(data, 'REFERENCE_CODE', 'referenceCode'),
        authCode: pick(data, 'AUTH_CODE', 'authCode'),
        responseCode: pick(data, 'RESPONSE_CODE', 'responseCode'),
        use3D: pick(data, 'USE_3D', 'use3D'),
        rnd: pick(data, 'RND', 'rnd'),
        installment: pick(data, 'INSTALLMENT', 'installment'),
        authorizationAmount: pick(data, 'AUTHORIZATION_AMOUNT', 'authorizationAmount'),
        currencyCode: pick(data, 'CURRENCY_CODE', 'currencyCode'),
        incomingHash: pick(data, 'hashDataV2', 'HASHDATAV2', 'hashData'),
        clientRefCode: pick(data, 'clientRefCode', 'CLIENT_REFERENCE_CODE', 'clientReferenceCode'),
        responseMessage: pick(data, 'RESPONSE_MESSAGE', 'responseMessage', 'RESPONSE_DATA'),
        txnTimestamp: pick(data, 'TIMESTAMP', 'timestamp', 'TRANSACTION_DATE'),
        tranId: pick(data, 'TRAN_ID', 'TranId', 'tranId', 'csTranId', 'CS_TRAN_ID'),
      },
      { secretKey: SECRET_KEY, vposUrl: VPOS_URL, sx: SX },
    )

    if (!result.hashValid || !result.matched) {
      return htmlResponse(redirectHtml(FAIL_REDIRECT))
    }

    return htmlResponse(redirectHtml(result.isSuccess || result.alreadyPaid ? SUCCESS_REDIRECT : FAIL_REDIRECT))
  } catch (err) {
    console.error('[paynkolay-callback] error:', err)
    // Paynkolay'a hata patlatma; fail sayfasina yonlendir.
    return htmlResponse(redirectHtml(FAIL_REDIRECT))
  }
})
