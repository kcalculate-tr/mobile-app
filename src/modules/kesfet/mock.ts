// Keşfet mock sağlayıcı — sunucu yokken __DEV__ deneme ekranı ve testler için.
// Bellek içi; deterministik id'ler (Date.now/Math.random yok → test kararlı).
// Sunucu davranışını taklit eder: tepki toggle stats'ı günceller, idempotency
// anahtarı aynıysa yeni kayıt AÇMAZ.
import type {
  AddToDayResult,
  FeedPage,
  FeedPost,
  FeedTab,
  KesfetClient,
  ReactResult,
} from './types';

function samplePost(i: number, opts: Partial<FeedPost> = {}): FeedPost {
  return {
    id: `post-${i}`,
    author: {
      id: `author-${i % 3}`,
      display_name: ['Kcalculate', 'Dyt. Elif', 'PT Can'][i % 3],
      handle: ['kcalculate', 'dyt.elif', 'pt.can'][i % 3],
      avatar_url: null,
      role: ['kurum', 'dietitian', 'pt'][i % 3],
      verified: i % 3 === 0,
    },
    published_at: `2026-11-0${(i % 9) + 1}T10:00:00.000Z`,
    lang: 'tr',
    body: `Örnek gönderi #${i} — dengeli bir öğün.`,
    media: [{ url: `https://example.invalid/post-${i}.jpg`, width: 1080, height: 1080 }],
    meal_card: {
      name: 'Izgara tavuk + bulgur',
      kcal: 520 + i * 10,
      protein_g: 42,
      carbs_g: 48,
      fat_g: 14,
      portion_label: '1 porsiyon',
      photo_url: null,
      product_id: i % 2 === 0 ? `product-${i}` : null,
    },
    quote: null,
    thread: null,
    stats: { likes: 10 + i, saves: 3 + i, adds: i },
    me: { liked: false, saved: false },
    ...opts,
  };
}

export interface MockKesfetOptions {
  /** Toplam örnek gönderi sayısı (varsayılan 7). */
  count?: number;
  /** 'following' sekmesinde görünecek gönderi index'leri (varsayılan ilk 3). */
  followingIndexes?: number[];
}

export function createMockKesfetClient(options: MockKesfetOptions = {}): KesfetClient & {
  _addedKeys: Map<string, string>;
} {
  const count = options.count ?? 7;
  const posts: FeedPost[] = Array.from({ length: count }, (_, i) => samplePost(i));
  const followingSet = new Set(options.followingIndexes ?? [0, 1, 2]);
  // idempotency: anahtar → consumption_id (aynı anahtar → aynı kayıt)
  const addedKeys = new Map<string, string>();

  function pool(tab: FeedTab): FeedPost[] {
    return tab === 'following' ? posts.filter((_, i) => followingSet.has(i)) : posts;
  }

  return {
    _addedKeys: addedKeys,

    async getFeed({ tab, cursor = null, limit = 20 }): Promise<FeedPage> {
      const list = pool(tab);
      const start = cursor ? Number(cursor) : 0;
      const slice = list.slice(start, start + limit);
      const nextStart = start + limit;
      return {
        items: slice.map((p) => ({ ...p, me: { ...p.me }, stats: { ...p.stats } })),
        next_cursor: nextStart < list.length ? String(nextStart) : null,
      };
    },

    async reactPost({ post, kind, on }): Promise<ReactResult> {
      const p = posts.find((x) => x.id === post);
      if (!p) throw new Error(`mock: bilinmeyen gönderi ${post}`);
      if (kind === 'like' && p.me.liked !== on) {
        p.me.liked = on;
        p.stats.likes += on ? 1 : -1;
      }
      if (kind === 'save' && p.me.saved !== on) {
        p.me.saved = on;
        p.stats.saves += on ? 1 : -1;
      }
      return { stats: { ...p.stats }, me: { ...p.me } };
    },

    async addPostMealToDay({ post, idempotencyKey }): Promise<AddToDayResult> {
      const existing = addedKeys.get(idempotencyKey);
      if (existing) return { consumption_id: existing };
      const id = `consumption-${post}-${addedKeys.size + 1}`;
      addedKeys.set(idempotencyKey, id);
      const p = posts.find((x) => x.id === post);
      if (p) p.stats.adds += 1;
      return { consumption_id: id };
    },

    async reportContent(): Promise<void> {
      // mock: kaydı yut
    },

    async blockUser(): Promise<void> {
      // mock: kaydı yut
    },
  };
}

/** __DEV__ deneme ekranı için varsayılan örnek istemci. */
export const mockKesfetClient = createMockKesfetClient();
