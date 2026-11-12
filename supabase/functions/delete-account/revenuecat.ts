// G31-S1 md.6 — Hesap silmede RevenueCat müşteri kaydı da silinir.
// Saf modül: Deno'ya özgü import YOK; fetch ve anahtar dışarıdan verilir → node testi
// (src/lib/account/__tests__/deleteAccountRevenueCat.test.ts) sahte fetch ile çalışır.
//
//  • İstek: DELETE https://api.revenuecat.com/v1/subscribers/{app_user_id}
//    başlık `Authorization: Bearer <REVENUECAT_SECRET_API_KEY>` (gizli anahtar; istemci
//    anahtarı DEĞİL). app_user_id = Supabase user id (istemci Purchases.logIn(userId)).
//  • 404 → kayıt zaten yok, başarı sayılır.
//  • Anahtar yoksa / ağ hatası / zaman aşımı / 2xx-404 dışı → { ok:false } döner, ATILMAZ:
//    çağıran loglar, hesap silme DURMAZ.
//  • Mağaza aboneliğini iptal ETMEZ (App Store / Google Play'de kullanıcı iptal eder).

export const RC_API_BASE = 'https://api.revenuecat.com/v1/subscribers/'
export const RC_TIMEOUT_MS = 8000

export type RevenueCatDeleteResult =
  | { ok: true; status: number; existed: boolean }
  | { ok: false; skipped: true; reason: 'no_key' | 'no_user' }
  | { ok: false; skipped: false; reason: string; status?: number }

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; signal?: AbortSignal }) => Promise<{ status: number; ok: boolean }>

export async function deleteRevenueCatSubscriber(opts: {
  appUserId: string
  secretKey: string | null | undefined
  fetchImpl?: FetchLike
  timeoutMs?: number
}): Promise<RevenueCatDeleteResult> {
  const key = (opts.secretKey ?? '').trim()
  const uid = (opts.appUserId ?? '').trim()
  if (!key) return { ok: false, skipped: true, reason: 'no_key' }
  if (!uid) return { ok: false, skipped: true, reason: 'no_user' }

  const doFetch: FetchLike = opts.fetchImpl ?? ((u, i) => fetch(u, i))
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? RC_TIMEOUT_MS)
  try {
    const res = await doFetch(RC_API_BASE + encodeURIComponent(uid), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: ctrl.signal,
    })
    if (res.status === 404) return { ok: true, status: 404, existed: false }
    if (res.ok) return { ok: true, status: res.status, existed: true }
    return { ok: false, skipped: false, reason: `http_${res.status}`, status: res.status }
  } catch (e) {
    const aborted = (e as { name?: string })?.name === 'AbortError'
    return { ok: false, skipped: false, reason: aborted ? 'timeout' : `network: ${String(e).slice(0, 200)}` }
  } finally {
    clearTimeout(timer)
  }
}
