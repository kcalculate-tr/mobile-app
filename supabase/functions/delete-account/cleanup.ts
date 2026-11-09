// G20-S3 md.7 (B-09) — Hesap silmede Storage nesneleri + ilişkili kayıtlar.
// Saf modül: Deno'ya özgü import YOK; admin istemcisi dışarıdan verilir → node
// testi (src/lib/account/__tests__/deleteAccountCleanup.test.ts) sahte istemciyle çalışır.
//
// Her adım best-effort: hata loglanır, silme durmaz (auth.users silinmesi esas).
// Sıra: önce yollar TOPLANIR (gönderi medyası kayıtlardan), sonra nesneler silinir,
// sonra kayıtlar silinir/anonimleştirilir; en son index.ts auth.admin.deleteUser.

// deno-lint-ignore no-explicit-any
type Any = any

export const STORAGE_PAGE = 1000
export const REMOVE_CHUNK = 100

/** Kullanıcının kovalardaki önekleri (istemci yükleme yollarıyla aynı). */
export function storageTargets(userId: string): { bucket: string; prefix: string; rootMatch?: (name: string) => boolean }[] {
  return [
    // avatars: kök dizinde `<uid>.<uzantı>` (src/modules/profil/avatarUpload.ts)
    { bucket: 'avatars', prefix: '', rootMatch: (n) => n.startsWith(`${userId}.`) },
    // user-media: `<uid>/scans/...` (Tara fotoğrafları, scanPath.ts)
    { bucket: 'user-media', prefix: userId },
    // post-media: `posts/<uid>/...` (foto + video, mediaPath.ts / video/rules.ts)
    { bucket: 'post-media', prefix: `posts/${userId}` },
    { bucket: 'post-media', prefix: userId },
    // support-attachments: `tickets/<uid>/...` (destek ekleri)
    { bucket: 'support-attachments', prefix: `tickets/${userId}` },
  ]
}

/** Kova içinde öneki altında BÜTÜN nesneler (klasörlere iner, sayfalı). */
export async function listAll(storage: Any, bucket: string, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 6) return []
  const out: string[] = []
  for (let offset = 0; ; offset += STORAGE_PAGE) {
    const { data, error } = await storage.from(bucket).list(prefix, { limit: STORAGE_PAGE, offset })
    if (error || !Array.isArray(data) || data.length === 0) break
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name
      // Storage list: klasörlerde id null
      if (item.id == null) out.push(...(await listAll(storage, bucket, full, depth + 1)))
      else out.push(full)
    }
    if (data.length < STORAGE_PAGE) break
  }
  return out
}

/** post_media.url (public URL ya da yol) → post-media kova yolu. */
export function postMediaPath(urlOrPath: unknown): string | null {
  if (typeof urlOrPath !== 'string' || !urlOrPath) return null
  const m = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/post-media\/([^?#]+)/.exec(urlOrPath)
  const p = m ? decodeURIComponent(m[1]) : /^https?:/.test(urlOrPath) ? null : urlOrPath
  return p && !p.includes('..') ? p.replace(/^\/+/, '') : null
}

export type CleanupReport = {
  storage: Record<string, number>
  records: Record<string, 'ok' | 'error'>
  errors: string[]
}

async function step(report: CleanupReport, name: string, fn: () => Promise<{ error?: Any } | void>) {
  try {
    const r = await fn()
    const err = r && (r as Any).error
    report.records[name] = err ? 'error' : 'ok'
    if (err) report.errors.push(`${name}: ${err.message ?? String(err)}`)
  } catch (e) {
    report.records[name] = 'error'
    report.errors.push(`${name}: ${String(e)}`)
  }
}

/** Kullanıcının gönderilerine bağlı medya yolları (kayıt silinmeden ÖNCE toplanır). */
export async function collectPostMediaPaths(admin: Any, userId: string): Promise<{ postIds: string[]; paths: string[] }> {
  try {
    const { data: posts } = await admin.from('posts').select('id').eq('author_id', userId)
    const postIds = (posts ?? []).map((p: Any) => String(p.id))
    if (postIds.length === 0) return { postIds, paths: [] }
    const { data: media } = await admin.from('post_media').select('url, thumb_path, frame_paths').in('post_id', postIds)
    const paths = new Set<string>()
    for (const m of media ?? []) {
      for (const v of [m.url, m.thumb_path, ...(Array.isArray(m.frame_paths) ? m.frame_paths : [])]) {
        const p = postMediaPath(v)
        if (p) paths.add(p)
      }
    }
    return { postIds, paths: [...paths] }
  } catch {
    return { postIds: [], paths: [] }
  }
}

/** Storage: kullanıcının bütün nesneleri (önekler + gönderi medyası). */
export async function removeUserStorage(admin: Any, userId: string, extraPostMedia: string[] = []): Promise<CleanupReport> {
  const report: CleanupReport = { storage: {}, records: {}, errors: [] }
  const byBucket = new Map<string, Set<string>>()
  const add = (b: string, p: string) => {
    if (!byBucket.has(b)) byBucket.set(b, new Set())
    byBucket.get(b)!.add(p)
  }
  for (const t of storageTargets(userId)) {
    try {
      if (t.rootMatch) {
        const { data } = await admin.storage.from(t.bucket).list('', { limit: STORAGE_PAGE, offset: 0, search: userId })
        for (const item of data ?? []) if (item.id != null && t.rootMatch(item.name)) add(t.bucket, item.name)
      } else {
        for (const p of await listAll(admin.storage, t.bucket, t.prefix)) add(t.bucket, p)
      }
    } catch (e) {
      report.errors.push(`list ${t.bucket}/${t.prefix}: ${String(e)}`)
    }
  }
  for (const p of extraPostMedia) add('post-media', p)

  for (const [bucket, set] of byBucket) {
    const paths = [...set]
    let removed = 0
    for (let i = 0; i < paths.length; i += REMOVE_CHUNK) {
      const chunk = paths.slice(i, i + REMOVE_CHUNK)
      try {
        const { error } = await admin.storage.from(bucket).remove(chunk)
        if (error) report.errors.push(`remove ${bucket}: ${error.message ?? String(error)}`)
        else removed += chunk.length
      } catch (e) {
        report.errors.push(`remove ${bucket}: ${String(e)}`)
      }
    }
    report.storage[bucket] = removed
  }
  return report
}

/**
 * İlişkili kayıtlar (deleteUser'dan ÖNCE). auth.users CASCADE'i kapsamayan ya da
 * kişisel veri taşıyan satırlar: silinir ya da kişisel alan boşaltılır. Mali kayıt
 * (orders) SİLİNMEZ — index.ts'teki anonimleştirmeye ek olarak konum/ham veri boşalır.
 */
export async function cleanupUserRecords(admin: Any, userId: string, postIds: string[], report?: CleanupReport): Promise<CleanupReport> {
  const r: CleanupReport = report ?? { storage: {}, records: {}, errors: [] }
  // Destek talepleri: FK'de ON DELETE yok → deleteUser'ı engelleyebilir; mesaj kişisel.
  await step(r, 'support_tickets', () => admin.from('support_tickets').delete().eq('user_id', userId))
  // Gönderiler + medya kayıtları (nesneler removeUserStorage'da silindi).
  if (postIds.length > 0) {
    await step(r, 'post_media', () => admin.from('post_media').delete().in('post_id', postIds))
    await step(r, 'posts', () => admin.from('posts').delete().eq('author_id', userId))
  }
  await step(r, 'follows_out', () => admin.from('follows').delete().eq('follower_id', userId))
  await step(r, 'follows_in', () => admin.from('follows').delete().eq('following_id', userId))
  await step(r, 'push_tokens', () => admin.from('push_tokens').delete().eq('user_id', userId))
  await step(r, 'notification_sends', () => admin.from('notification_sends').delete().eq('user_id', userId))
  await step(r, 'analytics_events', () => admin.from('analytics_events').delete().eq('user_id', userId))
  await step(r, 'feedback', () => admin.from('feedback').update({ user_email: null, user_id: null }).eq('user_id', userId))
  await step(r, 'campaign_targets', () => admin.from('campaign_targets').update({ user_email: null, user_id: null }).eq('user_id', userId))
  await step(r, 'order_modifications', () =>
    admin.from('order_modifications').update({ new_address_text: null, customer_note: null }).eq('user_id', userId),
  )
  return r
}

/** orders anonimleştirmesine eklenen alanlar (konum + ham entegrasyon verisi). */
export const ORDER_ANON_EXTRA = {
  city: null,
  district: null,
  neighbourhood: null,
  external_payload: null,
} as const
