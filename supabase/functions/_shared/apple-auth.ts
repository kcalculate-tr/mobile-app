// Apple Sign in with Apple — sunucu tarafı client_secret (ES256 JWT) üretimi +
// authorization_code -> refresh_token değişimi + token iptali (revoke).
// Bu repoda dış bir JWT kütüphanesi kullanılmıyor (bkz. generatePaynkolayHash,
// crypto.subtle tabanlı) — aynı desen izleniyor, native Web Crypto API.
//
// GÜVENLİK: refresh_token / private key HİÇBİR ZAMAN loglanmaz.

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlEncodeString(str: string): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(str))
}

async function importApplePrivateKey(pem: string): Promise<CryptoKey> {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')
  const der = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0))
  return await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
}

// Apple'ın istediği client_secret: ES256 imzalı, kısa ömürlü (burada 5dk) JWT.
// Her çağrıda taze üretilir, hiçbir yerde saklanmaz.
export async function buildAppleClientSecret(opts: {
  teamId: string
  keyId: string
  clientId: string
  privateKeyPem: string
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'ES256', kid: opts.keyId }
  const payload = {
    iss: opts.teamId,
    iat: now,
    exp: now + 300,
    aud: 'https://appleid.apple.com',
    sub: opts.clientId,
  }
  const signingInput = `${base64UrlEncodeString(JSON.stringify(header))}.${base64UrlEncodeString(JSON.stringify(payload))}`

  const key = await importApplePrivateKey(opts.privateKeyPem)
  // WebCrypto ECDSA/P-256 imzası zaten JWS'in istediği ham r||s (64 byte)
  // formatında döner — DER'e çevirmeye gerek yok.
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  )
  return `${signingInput}.${base64UrlEncodeBytes(new Uint8Array(signature))}`
}

export async function exchangeAppleAuthorizationCode(opts: {
  authorizationCode: string
  clientId: string
  clientSecret: string
}): Promise<{ refreshToken?: string; error?: string }> {
  const res = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: opts.authorizationCode,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
    }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.refresh_token) {
    return { error: json?.error ? String(json.error) : `Apple token endpoint HTTP ${res.status}` }
  }
  return { refreshToken: String(json.refresh_token) }
}

export async function revokeAppleRefreshToken(opts: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      token: opts.refreshToken,
      token_type_hint: 'refresh_token',
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false, error: `Apple revoke HTTP ${res.status}: ${text}` }
  }
  return { ok: true }
}
