// G18-S4 md.4 — FinFeedEmpty / FinFollowingEmpty: "Başlangıç için" (Marka/Editör
// etiketli kcal içerikleri) ve "Davetli üreticiler". SAF: yalnız GERÇEK akış
// gönderilerinden türetilir; yoksa liste boş → bölüm gizli (uydurma yok).
import type { FeedPost } from './types';

export type StarterLabel = 'brand' | 'editor';

export interface StarterItem {
  postId: string;
  label: StarterLabel;
  handle: string;
  authorName: string;
  avatarUrl: string | null;
  title: string;
  imageUrl: string;
  /** Öğün kartı (tarif + değerler) varsa "Tarif ve değerleri" alt satırı. */
  hasRecipe: boolean;
}

export interface InvitedCreator {
  id: string;
  display_name: string;
  handle: string;
  role: string;
  verified: boolean;
  avatar_url: string | null;
  bio?: string | null;
}

/** kcal resmi hesabı (kurum) → "Marka"; kcal editörü (moderator) → "Editör". */
export function starterLabel(role: string): StarterLabel | null {
  switch (role) {
    case 'kurum':
    case 'official':
      return 'brand';
    case 'moderator':
    case 'editor':
      return 'editor';
    default:
      return null;
  }
}

/** Davet edilen (paylaşım izni olan) üretici rolleri — kcal hesapları hariç. */
const CREATOR_ROLES = new Set(['diyetisyen', 'dietitian', 'dyt', 'pt', 'uretici', 'producer']);

export function isInvitedCreatorRole(role: string): boolean {
  return CREATOR_ROLES.has(role);
}

function postImage(p: FeedPost): string | null {
  const img = p.media.find((m) => (m.kind ?? 'image') === 'image' && !!m.url);
  return img?.url ?? p.meal_card?.photo_url ?? null;
}

function postTitle(p: FeedPost): string {
  const name = p.meal_card?.name?.trim();
  if (name) return name;
  const first = p.body.split('\n').map((s) => s.trim()).find(Boolean) ?? '';
  return first.length > 80 ? `${first.slice(0, 79).trimEnd()}…` : first;
}

/** Başlangıç kartları: yalnız kcal (Marka/Editör) + görselli + başlıklı gönderiler. */
export function deriveStarters(posts: FeedPost[], max = 6): StarterItem[] {
  const out: StarterItem[] = [];
  for (const p of posts) {
    if (p.status && p.status !== 'published') continue;
    const label = starterLabel(p.author.role);
    if (!label) continue;
    const imageUrl = postImage(p);
    const title = postTitle(p);
    if (!imageUrl || !title) continue;
    out.push({
      postId: p.id,
      label,
      handle: p.author.handle,
      authorName: p.author.display_name,
      avatarUrl: p.author.avatar_url,
      title,
      imageUrl,
      hasRecipe: !!p.meal_card,
    });
    if (out.length >= max) break;
  }
  return out;
}

/** Davetli üreticiler: akıştaki paylaşım izinli (rol rozetli) yazarlar, tekil. */
export function deriveInvitedCreators(posts: FeedPost[], max = 3): InvitedCreator[] {
  const seen = new Map<string, InvitedCreator>();
  for (const p of posts) {
    const a = p.author;
    if (!CREATOR_ROLES.has(a.role) || seen.has(a.id)) continue;
    seen.set(a.id, {
      id: a.id,
      display_name: a.display_name,
      handle: a.handle,
      role: a.role,
      verified: a.verified,
      avatar_url: a.avatar_url,
    });
    if (seen.size >= max) break;
  }
  return Array.from(seen.values());
}
