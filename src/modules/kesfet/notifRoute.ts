// G58-S1 md.2 — Sosyal bildirim dokunuşu → hedef rota. SAF (RN yok) → tsx birim testi.
//  • Gönderiye bağlı bildirim (beğeni, yorum, yanıt, günüme ekledi, yaptım) → SharedPost
//    (yorum/yanıtta `commentId` da taşınır).
//  • Gönderisiz (takip, takip isteği, takip onayı) → PublicProfile { handle: handle || id }.
//    G57: handle'sız kullanıcıda kimlik ile açılır (get_public_profile uuid'yi tanır).
//  • Sistem / şikâyet sonucu satırı dokunuşla açılmaz.
import type { SocialNotification } from './types';

export type NotifTarget =
  | { name: 'SharedPost'; params: { postId: string; commentId?: string } }
  | { name: 'PublicProfile'; params: { handle: string } }
  | null;

export function notificationTarget(n: Pick<SocialNotification, 'kind' | 'post_id' | 'comment_id' | 'actor'>): NotifTarget {
  if (n.kind === 'system' || n.kind === 'report_result') return null;
  if (n.post_id) {
    const withComment = (n.kind === 'comment' || n.kind === 'reply') && n.comment_id;
    return { name: 'SharedPost', params: withComment ? { postId: n.post_id, commentId: n.comment_id as string } : { postId: n.post_id } };
  }
  const handle = (n.actor.handle ?? '').trim() || (n.actor.id ?? '').trim();
  return handle ? { name: 'PublicProfile', params: { handle } } : null;
}

/**
 * Okundu işaretinin üst sınırı: yüklenen EN YENİ bildirimin zamanı. Yükleme ile işaretleme arasında
 * gelen (kullanıcının görmediği) bildirim okunmuş sayılmaz. Liste boşsa null (sunucu: now()).
 */
export function markReadUntil(items: readonly Pick<SocialNotification, 'created_at'>[]): string | null {
  let max: string | null = null;
  for (const n of items) if (n.created_at && (max == null || Date.parse(n.created_at) > Date.parse(max))) max = n.created_at;
  return max;
}

/** respond_follow_request 'istek_yok' → istek zaten sonuçlanmış/iptal; satır geri GELMEZ. */
export function followRequestGone(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : String((e as { message?: unknown } | null)?.message ?? '');
  return /istek_yok/.test(msg);
}
