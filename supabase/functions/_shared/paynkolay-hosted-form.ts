// PaynKolay hosted (ortak ödeme) sayfasına otomatik POST eden form — Kart Ekle
// (1 TL doğrulama) için. Import'suz/Deno.env'siz (Node testlerinde çalışır).
// paynkolay-payment-init'teki form/hash mantığının BİLEREK ayrı kopyası (o
// dosyaya dokunulmaz); alanlar ve hash sırası ondan BİREBİR.

export const PAYNKOLAY_CURRENCY_TRY = '949'

export function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function buildAutoSubmitForm(actionUrl: string, fields: Record<string, string>): string {
  const inputs = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}" />`)
    .join('\n      ')
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body onload="document.forms[0].submit()">
    <form method="POST" action="${escapeHtml(actionUrl)}">
      ${inputs}
    </form>
  </body>
</html>`
}

/** amount -> ondalık TL string ("1.00"). */
export function toDecimalTL(value: number): string {
  return Number(value || 0).toFixed(2)
}

/** Paynkolay rnd = "dd.MM.yyyy HH:mm:ss" (GMT+3) — form ve hash AYNI değeri kullanmalı. */
export function getRnd(now: Date = new Date()): string {
  const tr = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(tr.getUTCDate())}.${pad(tr.getUTCMonth() + 1)}.${tr.getUTCFullYear()} ` +
    `${pad(tr.getUTCHours())}:${pad(tr.getUTCMinutes())}:${pad(tr.getUTCSeconds())}`
}

export async function generatePaynkolayHash(parts: string[]): Promise<string> {
  const data = new TextEncoder().encode(parts.join('|'))
  const digest = await (globalThis as any).crypto.subtle.digest('SHA-512', data)
  const bytes = new Uint8Array(digest)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return (globalThis as any).btoa(bin)
}

export interface CardVerificationFormParams {
  sx: string
  secretKey: string
  vposUrl: string
  clientRefCode: string
  amount: string // "1.00"
  successUrl: string
  failUrl: string
  rnd: string
  customerKey: string // ZORUNLU (kart saklama)
  cardHolderIP: string
  agentCode?: string // sadece sub-merchant secret'ı tanımlıysa
  cardAlias?: string
}

/**
 * 1 TL doğrulama formu: use3D=true, csAutoSave=true, customerKey ile.
 * Hash: sx|clientRefCode|amount|successUrl|failUrl|rnd|customerKey|secret
 * (payment-init'in kart-saklama yoluyla aynı).
 */
export async function buildCardVerificationForm(
  p: CardVerificationFormParams,
): Promise<{ fields: Record<string, string>; formHtml: string }> {
  if (!p.customerKey) throw new Error('customerKey zorunlu')
  if (!p.clientRefCode) throw new Error('clientRefCode zorunlu')
  if (!(Number(p.amount) > 0)) throw new Error('amount geçersiz')

  const hashDataV2 = await generatePaynkolayHash([
    p.sx, p.clientRefCode, p.amount, p.successUrl, p.failUrl, p.rnd, p.customerKey, p.secretKey,
  ])

  const fields: Record<string, string> = {
    sx: p.sx,
    clientRefCode: p.clientRefCode,
    amount: p.amount,
    currencyCode: PAYNKOLAY_CURRENCY_TRY,
    successUrl: p.successUrl,
    failUrl: p.failUrl,
    rnd: p.rnd,
    use3D: 'true',
    transactionType: 'sales',
    instalments: '',
    cardHolderIP: p.cardHolderIP,
    hashDataV2,
  }
  if (p.agentCode) fields.agentCode = p.agentCode
  fields.customerKey = p.customerKey
  fields.csAutoSave = 'true'
  fields.csCardAlias = p.cardAlias ?? 'KCAL kartım'

  return { fields, formHtml: buildAutoSubmitForm(p.vposUrl, fields) }
}
