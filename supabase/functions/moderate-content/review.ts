// G62-S1 — sipariş değerlendirmesi (reviews) denetimi için SAF yardımcılar (Deno + Node testleri ortak).
// Hedef kimliği reviews.moderation_id (uuid); reviews.id bigint olduğu için kuyruk/şikâyet tabloları bunu kullanır.
// Durum: is_approved=true → karar verilmiş (atla); false → bekliyor.

export interface ReviewRowLite {
  user_id: string | null
  comment: string | null
  is_approved: boolean | null
  photo_path: string | null
}

/** Denetlenecek metin (yorum). Yoksa ''. */
export function reviewModerationText(row: ReviewRowLite): string {
  return typeof row.comment === 'string' ? row.comment.trim().slice(0, 500) : ''
}

/**
 * Denetime gönderilecek görsel yolu: yalnız `user-media` kovasında yazarın `<uid>/reviews/` klasörü.
 * Tam URL, başka klasör, `..` → atlanır.
 */
export function reviewImagePaths(row: ReviewRowLite): string[] {
  const p = row.photo_path
  if (!p || typeof p !== 'string' || !row.user_id) return []
  if (!p.startsWith(`${row.user_id}/reviews/`) || p.includes('..')) return []
  return [p]
}

/** Metin de görsel de yoksa denetlenecek bir şey yok (yalnız puan). */
export function reviewNeedsModeration(row: ReviewRowLite): boolean {
  return reviewModerationText(row).length > 0 || reviewImagePaths(row).length > 0
}

/** Kuyruk durumu eşlemesi: onaylıysa 'published' (karar verilmiş), değilse 'pending'. */
export function reviewStatus(row: ReviewRowLite): 'pending' | 'published' {
  return row.is_approved ? 'published' : 'pending'
}
