// Saklı kartla (API modu, /v1/Payment, use3D=true) ödemede PaynKolay ham JSON
// döner — USE_3D, BANK_REQUEST_MESSAGE, REFERENCE_CODE, sessionId, ... .
// 3D sayfası bu JSON'un KENDİSİ DEĞİL; BANK_REQUEST_MESSAGE'ın içindedir. Bu
// modül o mesajı WebView'de render edilebilir bir HTML'e çevirir. Saf string
// işleri — Deno'ya/RN'ye bağımlı değil (Node testlerinde de çalışır).
//
// BANK_REQUEST_MESSAGE'ın biçimi PaynKolay dokümanında/yanıtlarda tek tip
// değil: düz HTML, URL-encoded HTML, HTML-entity'li HTML, base64 HTML ya da
// bir URL olabilir. Hepsi tolere edilir; tanınmayan biçim HATA sayılır ve
// ham içerik ASLA istemciye geçmez.

export type ThreeDFormat =
  | 'html'
  | 'html_urlencoded'
  | 'html_entities'
  | 'base64_html'
  | 'url'
  | 'empty'
  | 'unknown'

const HTML_HINT = /<\s*(form|html|body|script|iframe|meta)\b/i

export function looksLikeHtml(s: string): boolean {
  const t = s.trim()
  return t.startsWith('<') && HTML_HINT.test(t)
}

function decodeBase64Utf8(s: string): string | null {
  const compact = s.replace(/\s+/g, '')
  if (compact.length < 16 || compact.length % 4 !== 0) return null
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return null
  try {
    const g = globalThis as any
    const bin: string = g.atob(compact)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new g.TextDecoder('utf-8').decode(bytes)
  } catch {
    return null
  }
}

function unescapeEntities(s: string): string {
  return s
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function redirectPage(url: string): string {
  const u = escapeAttr(url)
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta http-equiv="refresh" content="0;url=${u}" /></head><body onload="window.location.replace(&quot;${u}&quot;)"></body></html>`
}

export function normalize3DMessage(message: unknown): { html: string | null; format: ThreeDFormat } {
  if (typeof message !== 'string' || message.trim() === '') return { html: null, format: 'empty' }
  const t = message.trim()

  if (looksLikeHtml(t)) return { html: t, format: 'html' }

  if (/^%3C/i.test(t)) {
    try {
      const d = decodeURIComponent(t)
      if (looksLikeHtml(d)) return { html: d.trim(), format: 'html_urlencoded' }
    } catch { /* düş */ }
  }

  if (/^&lt;/i.test(t)) {
    const d = unescapeEntities(t)
    if (looksLikeHtml(d)) return { html: d.trim(), format: 'html_entities' }
  }

  const b64 = decodeBase64Utf8(t)
  if (b64 !== null && looksLikeHtml(b64)) return { html: b64.trim(), format: 'base64_html' }

  if (/^https:\/\/\S+$/i.test(t)) return { html: redirectPage(t), format: 'url' }

  return { html: null, format: 'unknown' }
}

export type Pay3DParse =
  | { kind: 'form'; html: string; format: ThreeDFormat; keys: string[] }
  | { kind: 'error'; reason: 'provider_error' | 'unparseable'; providerError: string; format: ThreeDFormat; keys: string[] }

function ci(obj: Record<string, unknown>, ...names: string[]): unknown {
  const lower = new Map(Object.keys(obj).map((k) => [k.toLowerCase(), k]))
  for (const n of names) {
    const k = lower.get(n.toLowerCase())
    if (k !== undefined) return obj[k]
  }
  return undefined
}

const isBlank = (v: unknown) =>
  v === undefined || v === null || String(v).trim() === '' || String(v).trim().toLowerCase() === 'null'

/** /v1/Payment (use3D=true) ham yanıtını 3D formuna ya da kontrollü bir hataya çevirir. */
export function parsePay3DResponse(raw: string): Pay3DParse {
  const text = String(raw ?? '')
  let json: Record<string, unknown> | null = null
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) json = parsed as Record<string, unknown>
  } catch { json = null }

  if (!json) {
    const n = normalize3DMessage(text)
    if (n.html && n.format !== 'url') return { kind: 'form', html: n.html, format: n.format, keys: [] }
    return { kind: 'error', reason: 'unparseable', providerError: '', format: n.format, keys: [] }
  }

  const keys = Object.keys(json)
  const providerErr = ci(json, 'ERROR_MESSAGE', 'errorMessage')
  const providerError = isBlank(providerErr) ? '' : String(providerErr)
  const n = normalize3DMessage(ci(json, 'BANK_REQUEST_MESSAGE', 'bankRequestMessage'))

  if (providerError && !n.html) {
    return { kind: 'error', reason: 'provider_error', providerError, format: n.format, keys }
  }
  if (!n.html) {
    return { kind: 'error', reason: 'unparseable', providerError, format: n.format, keys }
  }
  return { kind: 'form', html: n.html, format: n.format, keys }
}
