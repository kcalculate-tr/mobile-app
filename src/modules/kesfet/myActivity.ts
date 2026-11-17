// G57 (17 Kas) — Keşfet "Etkinliğim": kaydedilen / beğenilen / yorum yapılan gönderiler
// (`get_my_post_activity` RPC) + ilk beğeni/kaydet/yorumda BİR KEZ gösterilen yönlendirme.
// Ağ/AsyncStorage dışarıdan verilir → saf çekirdek birim testinde sınanır.
import type { MealCard, ActivityCard } from './types';

export type MyActivityKind = 'save' | 'like' | 'comment';
export type MyActivityTab = 'saved' | 'liked' | 'comments';

export const TAB_KIND: Record<MyActivityTab, MyActivityKind> = { saved: 'save', liked: 'like', comments: 'comment' };
export const KIND_TAB: Record<MyActivityKind, MyActivityTab> = { save: 'saved', like: 'liked', comment: 'comments' };

export interface MyActivityItem {
  id: string;
  post_type: string;
  body: string;
  published_at: string;
  acted_at: string;
  my_comment: string | null;
  meal_card: MealCard | null;
  activity_card: ActivityCard | null;
  media_url: string | null;
  author: { id: string; display_name: string; handle: string | null; avatar_url: string | null };
}

type RpcClient = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

/** Gönderi medyası depo içi yol olabilir → herkese açık adres. */
export type UrlResolver = (pathOrUrl: string) => string;

export async function fetchMyActivity(client: RpcClient, kind: MyActivityKind, resolveUrl: UrlResolver): Promise<MyActivityItem[]> {
  const { data, error } = await client.rpc('get_my_post_activity', { p_kind: kind, p_limit: 50 });
  if (error) throw new Error(error.message || 'my_activity_failed');
  const items = ((data as { items?: unknown[] } | null)?.items ?? []) as MyActivityItem[];
  return items.map((it) => ({ ...it, media_url: it.media_url ? resolveUrl(it.media_url) : null }));
}

/** Gönderinin ilk satırı (başlık gibi) — liste satırında gösterilir. */
export function firstLine(body: string | null | undefined, max = 90): string {
  const line = (body ?? '').split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

export interface TipStorage {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
}

export const firstTipKey = (kind: MyActivityKind) => `@kesfet_first_${kind}_tip`;

/** Bu tür eylem İLK kez mi? İlkse işaretler ve true döner (bildirim bir kez). Hata → false. */
export async function takeFirstActionTip(storage: TipStorage, kind: MyActivityKind): Promise<boolean> {
  try {
    if (await storage.getItem(firstTipKey(kind))) return false;
    await storage.setItem(firstTipKey(kind), '1');
    return true;
  } catch {
    return false;
  }
}

/** Gönderi metni akışta kısaltılsın mı (Twitter "Devamını gör")? */
export const FEED_BODY_LINES = 6;
export function isLongBody(body: string | null | undefined): boolean {
  const b = body ?? '';
  return b.length > 280 || b.split('\n').length > FEED_BODY_LINES;
}
