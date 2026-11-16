// G55-S1 md.0 + md.1 — toplu gönderim çekirdeği (Deno + node:test; supabase istemcisi DIŞARIDAN verilir).
//
// ── NEDEN PARÇALI (md.0) ───────────────────────────────────────────────────
// 14 Kas 2026 20:26 "herkes" kampanyası (829 hedef) 0 gönderimle "sent" oldu.
// `.in('user_id', [829 UUID])` PostgREST'te GET adresine yazılır
// (`?user_id=in.(…)` ≈ 32 KB). Edge loglarında:
//   GET | 400 | /rest/v1/notification_preferences?select=*&user_id=in.(9a74…
// Hata `{ data: null, error }` olarak döndü, kod `error`'a bakmıyordu → tercih
// haritası boş → 829 kişinin tamamı "marketing disabled by user" diye atlandı.
// Artık: her `.in()` en çok IN_CHUNK (100) değerle, sonuçlar birleştirilir;
// insert'ler INSERT_CHUNK (500) satırlık; HER sorgu/insert hatası loglanır.
// Okuma hatası (tercih / idempotency / token) gönderimi DURDURUR (throw): yanlış
// "kapalı" ya da çift gönderim yerine görünür hata — by_campaign bunu `failed`
// + hata mesajı olarak kampanyaya yazar.
//
// ── DİL (md.1) ─────────────────────────────────────────────────────────────
// Her token'ın `locale`'ine göre metin seçilir (bkz. locale.ts); Expo'ya dile göre
// ayrılmış gruplar hâlinde 100'lük partilerle gider. `push_tokens.locale` kolonu
// henüz yoksa (migration uygulanmadan deploy) token sorgusu kolonsuz tekrarlanır
// ve herkes TR alır — bugünkü davranış.
// Deno `.ts` uzantısı ister; uygulama tsc'si (testler bu dosyayı içe aktarır) izin vermez → ts-ignore.
// @ts-ignore TS5097
import { kategoriAcikMi, type Category } from './prefs.ts'
// @ts-ignore TS5097
import { normalizePushLocale, pickLocalized, type BilingualText, type PushLocale } from './locale.ts'

export const IN_CHUNK = 100
export const INSERT_CHUNK = 500
export const EXPO_BATCH = 100

export type { Category }

export type SendContent = {
  templateKey: string | null
  /** TR metin (+ isteğe bağlı `en`). */
  text: BilingualText
  deepLink: string | null
  category: Category
  data: Record<string, unknown> | null
  /** Expo mesajına eklenecek ek alanlar (FinPush kategori/kanal). */
  extras?: Record<string, unknown>
}

export type SendResults = {
  sent: number
  skipped: number
  failed: number
  /** Dile göre gönderilen (Expo'ya giden) token sayısı. */
  by_locale: Record<PushLocale, number>
  /** Loglanan yazma hataları (okuma hataları throw eder). */
  errors: string[]
  details: Array<Record<string, unknown>>
}

// Supabase istemcisinin burada kullanılan kısmı (testte sahte istemci verilir).
// deno-lint-ignore no-explicit-any
type Db = { from: (table: string) => any }
type DbResult<T> = { data: T | null; error: { message?: string; code?: string } | null }

export type BatchDeps = {
  db: Db
  fetchFn: typeof fetch
  expoHeaders: Record<string, string>
  log?: Pick<Console, 'error' | 'warn'>
  uuid?: () => string
}

export function parcala<T>(dizi: T[], boyut: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < dizi.length; i += boyut) out.push(dizi.slice(i, i + boyut))
  return out
}

function hataMetni(e: { message?: string; code?: string } | null | undefined): string {
  if (!e) return 'unknown error'
  return [e.code, e.message].filter(Boolean).join(' ') || 'unknown error'
}

/** `.in(kolon, değerler)` sorgusunu IN_CHUNK'lık parçalarla çalıştırır, satırları birleştirir; hata → throw. */
async function inParcali<T>(
  adim: string,
  degerler: string[],
  sorgu: (parca: string[]) => PromiseLike<DbResult<T[]>>,
  log: Pick<Console, 'error' | 'warn'>,
): Promise<T[]> {
  const out: T[] = []
  const parcalar = parcala(degerler, IN_CHUNK)
  for (let i = 0; i < parcalar.length; i++) {
    const { data, error } = await sorgu(parcalar[i])
    if (error) {
      const msg = `[send-notification] ${adim} sorgusu başarısız (parça ${i + 1}/${parcalar.length}): ${hataMetni(error)}`
      log.error(msg)
      throw new Error(msg)
    }
    if (data) out.push(...data)
  }
  return out
}

/** Satırları INSERT_CHUNK'lık parçalarla yazar; hata loglanır ve `errors`'a eklenir (gönderim sürer). */
async function insertParcali(
  db: Db,
  adim: string,
  satirlar: Array<Record<string, unknown>>,
  errors: string[],
  log: Pick<Console, 'error' | 'warn'>,
): Promise<void> {
  const parcalar = parcala(satirlar, INSERT_CHUNK)
  for (let i = 0; i < parcalar.length; i++) {
    const { error } = (await db.from('notification_sends').insert(parcalar[i])) as DbResult<unknown>
    if (error) {
      const msg = `[send-notification] ${adim} insert başarısız (parça ${i + 1}/${parcalar.length}, ${parcalar[i].length} satır): ${hataMetni(error)}`
      log.error(msg)
      errors.push(msg)
    }
  }
}

async function updateParcali(
  db: Db,
  tablo: string,
  adim: string,
  degisiklik: Record<string, unknown>,
  idler: string[],
  errors: string[],
  log: Pick<Console, 'error' | 'warn'>,
): Promise<void> {
  const parcalar = parcala(idler, IN_CHUNK)
  for (let i = 0; i < parcalar.length; i++) {
    const { error } = (await db.from(tablo).update(degisiklik).in('id', parcalar[i])) as DbResult<unknown>
    if (error) {
      const msg = `[send-notification] ${adim} update başarısız (parça ${i + 1}/${parcalar.length}): ${hataMetni(error)}`
      log.error(msg)
      errors.push(msg)
    }
  }
}

function localeKolonuYok(e: { message?: string; code?: string } | null): boolean {
  if (!e) return false
  return e.code === '42703' || /locale/i.test(e.message ?? '')
}

type TokenRow = { id: string; user_id: string; expo_push_token: string; locale?: string | null }

export async function sendToUsers(
  deps: BatchDeps,
  userIds: string[],
  content: SendContent,
): Promise<SendResults> {
  const { db, fetchFn, expoHeaders } = deps
  const log = deps.log ?? console
  const uuid = deps.uuid ?? (() => crypto.randomUUID())
  const results: SendResults = { sent: 0, skipped: 0, failed: 0, by_locale: { tr: 0, en: 0 }, errors: [], details: [] }
  const hedefKullanicilar = [...new Set((userIds ?? []).filter(Boolean))]
  if (hedefKullanicilar.length === 0) return results

  const ortak = {
    template_key: content.templateKey,
    category: content.category,
    deep_link: content.deepLink,
    data: content.data,
  }
  const trMetin = pickLocalized(content.text, 'tr')

  // 1) Tercihler
  const prefRows = await inParcali<Record<string, unknown>>(
    'tercih', hedefKullanicilar,
    (p) => db.from('notification_preferences').select('*').in('user_id', p),
    log,
  )
  const prefMap = new Map<string, Record<string, unknown>>(prefRows.map((r) => [String(r.user_id), r]))

  // 2) Idempotency (yalnız şablon bazlı gönderimlerde)
  const yakinZamandaGonderildi = new Set<string>()
  if (content.templateKey) {
    const besDakikaOnce = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const rows = await inParcali<{ user_id: string }>(
      'idempotency', hedefKullanicilar,
      (p) => db.from('notification_sends').select('user_id')
        .in('user_id', p)
        .eq('template_key', content.templateKey)
        .in('status', ['sent', 'delivered'])
        .gte('created_at', besDakikaOnce),
      log,
    )
    for (const r of rows) yakinZamandaGonderildi.add(String(r.user_id))
  }

  // 3) Token'lar (locale kolonu yoksa kolonsuz tekrar)
  let localeVar = true
  const tokenRows = await inParcali<TokenRow>(
    'token', hedefKullanicilar,
    async (p) => {
      if (localeVar) {
        const r = (await db.from('push_tokens').select('id, user_id, expo_push_token, locale')
          .in('user_id', p).eq('is_active', true)) as DbResult<TokenRow[]>
        if (!localeKolonuYok(r.error)) return r
        log.warn('[send-notification] push_tokens.locale yok (migration uygulanmamış) — herkes TR')
        localeVar = false
      }
      return db.from('push_tokens').select('id, user_id, expo_push_token')
        .in('user_id', p).eq('is_active', true)
    },
    log,
  )
  const tokenMap = new Map<string, TokenRow[]>()
  for (const t of tokenRows) {
    const uid = String(t.user_id)
    if (!tokenMap.has(uid)) tokenMap.set(uid, [])
    tokenMap.get(uid)!.push(t)
  }

  // 4) Kimler atlanacak, kimlere gidilecek
  type Hedef = { sendId: string; userId: string; tokenId: string; expoToken: string; locale: PushLocale }
  const hedefler: Hedef[] = []
  const atlananSatirlar: Array<Record<string, unknown>> = []

  for (const userId of hedefKullanicilar) {
    const prefs = prefMap.get(userId)
    if (!kategoriAcikMi(prefs, content.category)) {
      atlananSatirlar.push({
        ...ortak, ...trMetin, user_id: userId, status: 'skipped',
        error_message: `${content.category} disabled by user`,
      })
      results.skipped++
      continue
    }
    if (yakinZamandaGonderildi.has(userId)) { results.skipped++; continue }

    const tokenlar = tokenMap.get(userId) ?? []
    if (tokenlar.length === 0) {
      atlananSatirlar.push({ ...ortak, ...trMetin, user_id: userId, status: 'skipped', error_message: 'no active tokens' })
      results.skipped++
      continue
    }
    for (const t of tokenlar) {
      hedefler.push({
        sendId: uuid(), userId, tokenId: String(t.id), expoToken: String(t.expo_push_token),
        locale: normalizePushLocale(t.locale),
      })
    }
  }

  if (atlananSatirlar.length > 0) await insertParcali(db, 'skipped', atlananSatirlar, results.errors, log)
  if (hedefler.length === 0) return results

  // 5) queued satırları (her token kendi dilindeki metinle)
  await insertParcali(
    db, 'queued',
    hedefler.map((h) => ({
      ...ortak, ...pickLocalized(content.text, h.locale), id: h.sendId, user_id: h.userId, status: 'queued',
    })),
    results.errors, log,
  )

  // 6) Expo — dile göre iki grup, her grup 100'lük partiler. Ticket dizisi istek sırasını korur.
  const basarili: string[] = []
  const basarisiz: Array<{ sendId: string; hata: string }> = []
  const kapatilacakTokenlar: string[] = []
  const simdi = new Date().toISOString()

  for (const locale of ['tr', 'en'] as const) {
    const grup = hedefler.filter((h) => h.locale === locale)
    if (grup.length === 0) continue
    const metin = pickLocalized(content.text, locale)
    for (const parti of parcala(grup, EXPO_BATCH)) {
      const govde = parti.map((h) => ({
        to: h.expoToken,
        title: metin.title,
        body: metin.body,
        sound: 'default',
        data: {
          ...(content.data ?? {}),
          ...(content.deepLink ? { deep_link: content.deepLink } : {}),
          send_id: h.sendId,
        },
        priority: content.category === 'transactional' ? 'high' : 'normal',
        ...(content.extras ?? {}),
      }))

      try {
        const expoRes = await fetchFn('https://exp.host/--/api/v2/push/send', {
          method: 'POST', headers: expoHeaders, body: JSON.stringify(govde),
        })
        const expoData = await expoRes.json()
        const ticketlar = Array.isArray(expoData?.data) ? expoData.data : []
        if (!expoRes.ok || ticketlar.length === 0) {
          log.error(`[send-notification] Expo yanıtı HTTP ${expoRes.status}: ${JSON.stringify(expoData?.errors ?? expoData).slice(0, 300)}`)
        }

        parti.forEach((h, i) => {
          const ticket = ticketlar[i]
          if (ticket?.status === 'ok') {
            basarili.push(h.sendId)
            results.sent++
            results.by_locale[locale]++
            return
          }
          const hata = ticket?.message ?? expoData?.errors?.[0]?.message ?? 'Unknown Expo error'
          basarisiz.push({ sendId: h.sendId, hata })
          if (ticket?.details?.error === 'DeviceNotRegistered') kapatilacakTokenlar.push(h.tokenId)
          results.failed++
          results.details.push({ user_id: h.userId, error: hata })
        })
      } catch (e) {
        const msg = (e as Error)?.message ?? String(e)
        log.error(`[send-notification] Expo partisi başarısız (${parti.length} token): ${msg}`)
        for (const h of parti) {
          basarisiz.push({ sendId: h.sendId, hata: msg })
          results.failed++
          results.details.push({ user_id: h.userId, error: msg })
        }
      }
    }
  }

  // 7) Durumları toplu yaz
  if (basarili.length > 0) {
    await updateParcali(db, 'notification_sends', 'sent', { status: 'sent', sent_at: simdi }, basarili, results.errors, log)
  }
  if (basarisiz.length > 0) {
    const gruplar = new Map<string, string[]>()
    for (const b of basarisiz) {
      if (!gruplar.has(b.hata)) gruplar.set(b.hata, [])
      gruplar.get(b.hata)!.push(b.sendId)
    }
    for (const [hata, idler] of gruplar) {
      await updateParcali(db, 'notification_sends', 'failed', { status: 'failed', error_message: hata, sent_at: simdi }, idler, results.errors, log)
    }
  }
  if (kapatilacakTokenlar.length > 0) {
    await updateParcali(db, 'push_tokens', 'token-kapat', { is_active: false }, [...new Set(kapatilacakTokenlar)], results.errors, log)
  }

  return results
}

/**
 * by_campaign sonucu → kampanya satırı güncellemesi. Hedef > 0 iken hiç gönderilemediyse
 * `failed` + açıklayıcı hata (14 Kas'taki gibi sessiz "sent" yok).
 */
export function campaignOutcome(targetCount: number, r: Pick<SendResults, 'sent' | 'skipped' | 'failed' | 'errors'>): {
  status: 'sent' | 'failed'
  error_message: string | null
} {
  if (targetCount > 0 && r.sent === 0) {
    const neden = r.errors[0] ?? (r.failed > 0 ? `${r.failed} gönderim Expo'da başarısız` : `${r.skipped} hedefin tamamı atlandı`)
    return { status: 'failed', error_message: `0/${targetCount} gönderildi — ${neden}`.slice(0, 500) }
  }
  return { status: 'sent', error_message: r.errors.length > 0 ? r.errors.join(' | ').slice(0, 500) : null }
}
