// order-alert: sipariş bildirimleri + acil-durum uyarıları (Resend ile e-posta).
// type: 'test' | 'new_order' | 'stuck_alert'  (+ order_id)
//
// FAZ B (çok-şube): artık siparişin branch_id'sine göre O ŞUBENİN personeline
// (branch_users -> auth.users email) gönderilir. Şubede kayıtlı personel YOKSA
// (veya branch_id boşsa) eski davranışa düşer: global ALERT_TO adresine gider —
// hiçbir bildirim sessizce kaybolmaz.

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM = Deno.env.get('ALERT_FROM') ?? 'isletme@eatkcal.com'
const GLOBAL_TO = Deno.env.get('ALERT_TO') ?? 'iozisseven@gmail.com'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

async function sendEmail(to: string[], subject: string, html: string) {
  if (!RESEND_API_KEY) return { ok: false, status: 0, body: { error: 'RESEND_API_KEY yok' } }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  let body: any = null
  try { body = await r.json() } catch { body = null }
  return { ok: r.ok, status: r.status, body }
}

const money = (n: unknown) => `₺${Number(n ?? 0).toFixed(2)}`

function itemsHtml(o: any): string {
  if (!Array.isArray(o?.items)) return ''
  return o.items.map((it: any) => `${it.quantity ?? 1}× ${it.name ?? '-'}`).join('<br>')
}

// Siparişin şubesine kayıtlı personelin e-postalarını bul. Kimse yoksa (veya
// branch_id yoksa) bos dizi döner -> caller GLOBAL_TO'ya düşer.
async function resolveBranchRecipients(
  admin: SupabaseClient,
  branchId: string | null | undefined,
): Promise<{ emails: string[]; branchName: string | null }> {
  if (!branchId) return { emails: [], branchName: null }

  const { data: branch } = await admin.from('branches').select('name').eq('id', branchId).maybeSingle()
  const branchName = (branch as { name?: string } | null)?.name ?? null

  const { data: staff } = await admin.from('branch_users').select('user_id').eq('branch_id', branchId)
  const userIds = (staff ?? []).map((s: { user_id: string }) => s.user_id).filter(Boolean)
  if (userIds.length === 0) return { emails: [], branchName }

  const emails: string[] = []
  for (const uid of userIds) {
    try {
      const { data } = await admin.auth.admin.getUserById(uid)
      const email = data?.user?.email
      if (email) emails.push(email)
    } catch (e) {
      console.error('[order-alert] getUserById failed:', uid, e)
    }
  }
  return { emails, branchName }
}

Deno.serve(async (req) => {
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let body: any = {}
  try { body = await req.json() } catch { body = {} }
  const type = body.type ?? 'test'

  if (type === 'test') {
    const res = await sendEmail([GLOBAL_TO], 'KCAL • Test bildirimi', '<p>Test e-postası. Sipariş bildirim sistemi çalışıyor ✅</p>')
    return json({ sent: res.ok, resend: res })
  }

  const orderId = body.order_id
  if (!orderId) return json({ error: 'order_id_required' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE)
  const { data: o, error } = await admin.from('orders').select('*').eq('id', orderId).single()
  if (error || !o) return json({ error: 'order_not_found', detail: error?.message }, 404)

  const { emails: branchEmails, branchName } = await resolveBranchRecipients(admin, o.branch_id)
  const to = branchEmails.length > 0 ? branchEmails : [GLOBAL_TO]
  const branchLabel = branchName ? ` — ${branchName}` : ''

  if (type === 'new_order') {
    const subject = `🟢 Yeni sipariş${branchLabel}: ${o.order_code} — ${o.customer_name ?? ''}`
    const html = `
      <h2>Yeni sipariş geldi${branchName ? ` (${branchName})` : ''}</h2>
      <p><b>${o.order_code}</b> · ${o.customer_name ?? '-'} · ${o.phone ?? '-'}</p>
      <p><b>Ürünler:</b><br>${itemsHtml(o)}</p>
      <p><b>Tutar:</b> ${money(o.total_amount)} · <b>Ödeme:</b> ${o.payment_status} (${o.payment_method ?? o.payment_provider ?? '-'})</p>
      <p><b>Teslimat:</b> ${o.delivery_method ?? '-'} / ${o.delivery_type ?? '-'}</p>
      <p><b>Adisyo:</b> ${o.adisyo_sync_status}${o.adisyo_order_id ? (' (#' + o.adisyo_order_id + ')') : ''}</p>`
    const res = await sendEmail(to, subject, html)
    return json({ sent: res.ok, resend: res, to })
  }

  if (type === 'stuck_alert') {
    const subject = `⚠️ ACİL${branchLabel}: ${o.order_code} Adisyo'ya DÜŞMEDİ`
    const html = `
      <h2 style="color:#c1282e">Sipariş Adisyo'ya düşmedi!${branchName ? ` (${branchName})` : ''}</h2>
      <p><b>${o.order_code}</b> · ${o.customer_name ?? '-'} · ${o.phone ?? '-'}</p>
      <p><b>Ürünler:</b><br>${itemsHtml(o)}</p>
      <p><b>Tutar:</b> ${money(o.total_amount)}</p>
      <p><b>Adisyo durumu:</b> ${o.adisyo_sync_status} · deneme: ${o.adisyo_sync_attempts ?? 0}</p>
      <p><b>Hata:</b> ${o.adisyo_sync_error ?? '-'}</p>
      <p>Lütfen manuel kontrol et / mutfağa ilet.</p>`
    const res = await sendEmail(to, subject, html)
    return json({ sent: res.ok, resend: res, to })
  }

  return json({ error: 'unknown_type' }, 400)
})
