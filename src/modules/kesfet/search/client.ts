// G22-S2 md.4 — Keşfet arama istemcisi. Gerçek yol: Supabase RPC search_profiles /
// search_posts (security definer; görünürlük + engel SUNUCUDA süzülür). Supabase
// tembel yüklenir (bkz. ../client.ts notu) → node testlerinde ağ yok.
//
// Mock/vitrin: Keşfet istemcisi mock'a çevrilmişse (FeedDataLab, vitrin) arama da
// otomatik sahte istemciye düşer; testler `setSearchClient` ile enjekte eder.
import { getKesfetClient, realKesfetClient } from '../client';
import type { MealCard, PostType } from '../types';
import { mockSearchClient } from './mock';
import type { SearchClient, SearchFollowState, SearchPost, SearchProfile } from './types';

type SupabaseModule = typeof import('../../../core/supabase');
function sb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../../../core/supabase') as SupabaseModule).getSupabaseClient();
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function itemsOf(data: unknown): Record<string, unknown>[] {
  const items = (data as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]) : [];
}

const FOLLOW: readonly SearchFollowState[] = ['following', 'requested', 'none'];

export function normalizeProfile(raw: Record<string, unknown>): SearchProfile {
  const handle = str(raw.handle).replace(/^@+/, '');
  const me = str(raw.me_following) as SearchFollowState;
  return {
    id: String(raw.id ?? ''),
    display_name: str(raw.display_name) || handle,
    handle,
    avatar_url: typeof raw.avatar_url === 'string' && raw.avatar_url ? raw.avatar_url : null,
    role: str(raw.role, 'user'),
    verified: raw.verified === true,
    is_private: raw.is_private === true,
    me_following: FOLLOW.includes(me) ? me : 'none',
  };
}

export function normalizePost(raw: Record<string, unknown>): SearchPost {
  const a = (raw.author ?? {}) as Record<string, unknown>;
  const mc = raw.meal_card && typeof raw.meal_card === 'object' ? (raw.meal_card as MealCard) : null;
  return {
    id: String(raw.id ?? ''),
    author: {
      id: String(a.id ?? ''),
      display_name: str(a.display_name, 'Kcalculate'),
      handle: typeof a.handle === 'string' && a.handle ? a.handle.replace(/^@+/, '') : null,
      avatar_url: typeof a.avatar_url === 'string' && a.avatar_url ? a.avatar_url : null,
      role: str(a.role, 'user'),
      verified: a.verified === true,
    },
    published_at: str(raw.published_at),
    body: str(raw.body),
    post_type: (str(raw.post_type) || 'serbest') as PostType,
    meal_card: mc,
    media_url: typeof raw.media_url === 'string' && raw.media_url ? raw.media_url : null,
  };
}

export const realSearchClient: SearchClient = {
  async searchProfiles(q) {
    const { data, error } = await sb().rpc('search_profiles', { q });
    if (error) throw new Error(`search_profiles: ${error.message}`);
    return itemsOf(data).map(normalizeProfile).filter((p) => p.id && p.handle);
  },
  async searchPosts(q, kind) {
    const { data, error } = await sb().rpc('search_posts', { q, p_kind: kind });
    if (error) throw new Error(`search_posts: ${error.message}`);
    return itemsOf(data).map(normalizePost).filter((p) => p.id);
  },
};

let override: SearchClient | null = null;

export function getSearchClient(): SearchClient {
  if (override) return override;
  return getKesfetClient() === realKesfetClient ? realSearchClient : mockSearchClient;
}

export function setSearchClient(client: SearchClient): void {
  override = client;
}

export function resetSearchClient(): void {
  override = null;
}
