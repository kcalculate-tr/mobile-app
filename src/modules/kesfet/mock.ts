// Keşfet mock sağlayıcı — sunucu yokken __DEV__ deneme ekranı ve testler için.
// Bellek içi; deterministik id'ler (Date.now/Math.random yok → test kararlı).
// Sunucu davranışını taklit eder: tepki toggle stats'ı günceller, idempotency
// anahtarı aynıysa yeni kayıt AÇMAZ. G8: composer, yorum, etkinlik, bildirim.
import { estimateActivityKcal } from './activity';
import type {
  AddCommentResult,
  AddToDayResult,
  ActivityLogResult,
  ActivityType,
  Comment,
  CommentPage,
  CreatePostInput,
  CreatePostResult,
  DayActivity,
  DayActivityItem,
  FeedPage,
  FeedPost,
  FeedTab,
  KesfetClient,
  NotificationPage,
  ProductSearchItem,
  ProductSearchResult,
  RateLimitedResult,
  ReactResult,
  SocialNotification,
  UpdatePostResult,
} from './types';

// G11 — composer ürün arama için sahte ürünler (mock modu). Gerçek veri sunucuda.
const SAMPLE_PRODUCTS: ProductSearchItem[] = [
  { id: 'prod-1', name: 'Izgara tavuk göğsü', image_url: null, kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 },
  { id: 'prod-2', name: 'Tam yağlı yoğurt', image_url: null, kcal: 61, protein_g: 3.5, carbs_g: 4.7, fat_g: 3.3 },
  { id: 'prod-3', name: 'Haşlanmış yumurta', image_url: null, kcal: 78, protein_g: 6.3, carbs_g: 0.6, fat_g: 5.3 },
  { id: 'prod-4', name: 'Pişmiş bulgur', image_url: null, kcal: 83, protein_g: 3, carbs_g: 19, fat_g: 0.2 },
  { id: 'prod-5', name: 'Avokado', image_url: null, kcal: 160, protein_g: 2, carbs_g: 9, fat_g: 15 },
];

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
    media: [{ url: `https://example.invalid/post-${i}.jpg`, width: 1080, height: 1080, kind: 'image' }],
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
    stats: { likes: 10 + i, saves: 3 + i, adds: i, comments: i % 4, did_it: 0 },
    me: { liked: false, saved: false, is_author: false },
    post_type: 'ogun',
    status: 'published',
    activity_card: null,
    ...opts,
  };
}

// __DEV__ vitrininde bir etkinlik gönderisi de görünsün (tür çeşitliliği).
function sampleActivityPost(i: number): FeedPost {
  const minutes = 45;
  return samplePost(i, {
    body: 'Sabah koşusu tamam 🏃',
    meal_card: null,
    media: [],
    post_type: 'etkinlik',
    activity_card: {
      type: 'kosu',
      minutes,
      distance_km: 7.2,
      kcal_est: estimateActivityKcal('kosu', minutes),
      note: null,
    },
    stats: { likes: 24, saves: 2, adds: 0, comments: 3, did_it: 5 },
  });
}

function sampleComment(postId: string, i: number): Comment {
  return {
    id: `comment-${postId}-${i}`,
    post_id: postId,
    author: {
      id: `author-${i % 3}`,
      display_name: ['Kcalculate', 'Dyt. Elif', 'PT Can'][i % 3],
      handle: ['kcalculate', 'dyt.elif', 'pt.can'][i % 3],
      avatar_url: null,
      verified: i % 3 === 0,
    },
    parent_id: null,
    body: `Örnek yorum #${i}`,
    status: 'published',
    created_at: `2026-11-03T1${i % 10}:00:00.000Z`,
    reply_count: 0,
    can_delete: i % 3 === 2, // "PT Can" yorumları silinebilir (mock'ta ben)
  };
}

function sampleNotification(i: number, read: boolean): SocialNotification {
  const kinds: SocialNotification['kind'][] = ['like', 'comment', 'follow', 'did_it', 'add_to_day'];
  return {
    id: `notif-${i}`,
    actor: {
      id: `author-${i % 3}`,
      display_name: ['Kcalculate', 'Dyt. Elif', 'PT Can'][i % 3],
      handle: ['kcalculate', 'dyt.elif', 'pt.can'][i % 3],
      avatar_url: null,
    },
    kind: kinds[i % kinds.length],
    post_id: i % 2 === 0 ? `post-${i % 7}` : null,
    comment_id: null,
    created_at: `2026-11-03T0${i % 10}:00:00.000Z`,
    read_at: read ? '2026-11-03T12:00:00.000Z' : null,
  };
}

export interface MockKesfetOptions {
  /** Toplam örnek gönderi sayısı (varsayılan 7). */
  count?: number;
  /** 'following' sekmesinde görünecek gönderi index'leri (varsayılan ilk 3). */
  followingIndexes?: number[];
  /** Okunmamış bildirim sayısı (varsayılan 3; toplam 6 üretilir). */
  unreadCount?: number;
  /** Etkinlik gönderisini de ekle (vitrin). Varsayılan false (testler kararlı). */
  withActivityPost?: boolean;
  /** search_products RPC canlıda yokmuş gibi davran (düğme gizlenir testi). */
  productSearchUnavailable?: boolean;
  /** update_my_post RPC canlıda yokmuş gibi davran (düzenle gizlenir testi). */
  postEditUnavailable?: boolean;
}

export type MockKesfetClient = KesfetClient & {
  _addedKeys: Map<string, string>;
  _comments: Map<string, Comment[]>;
  _notifications: SocialNotification[];
  _activityLogs: DayActivityItem[];
};

export function createMockKesfetClient(options: MockKesfetOptions = {}): MockKesfetClient {
  const count = options.count ?? 7;
  const posts: FeedPost[] = Array.from({ length: count }, (_, i) => samplePost(i));
  if (options.withActivityPost) posts.push(sampleActivityPost(count));
  const followingSet = new Set(options.followingIndexes ?? [0, 1, 2]);
  // idempotency: anahtar → id (aynı anahtar → aynı kayıt)
  const addedKeys = new Map<string, string>();
  const createKeys = new Map<string, CreatePostResult>();
  const commentKeys = new Map<string, AddCommentResult>();
  const activityKeys = new Map<string, ActivityLogResult>();
  const comments = new Map<string, Comment[]>();
  // Deterministik başlangıç yorumları.
  for (const p of posts) {
    comments.set(p.id, Array.from({ length: p.stats.comments }, (_, i) => sampleComment(p.id, i)));
  }
  const unread = options.unreadCount ?? 3;
  const total = Math.max(unread, 6);
  const notifications: SocialNotification[] = Array.from({ length: total }, (_, i) =>
    sampleNotification(i, i >= unread),
  );
  const activityLogs: DayActivityItem[] = [];
  let seq = 0;

  function pool(tab: FeedTab): FeedPost[] {
    return tab === 'following' ? posts.filter((_, i) => followingSet.has(i)) : posts;
  }

  return {
    _addedKeys: addedKeys,
    _comments: comments,
    _notifications: notifications,
    _activityLogs: activityLogs,

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

    async getPost({ post }): Promise<FeedPost | null> {
      const p = posts.find((x) => x.id === post);
      return p ? { ...p, me: { ...p.me }, stats: { ...p.stats } } : null;
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

    // ── G8 ────────────────────────────────────────────────────────────────
    async createPost(input: CreatePostInput): Promise<CreatePostResult | RateLimitedResult> {
      const prev = createKeys.get(input.idempotencyKey);
      if (prev) return prev;
      seq += 1;
      const res: CreatePostResult = { post_id: `newpost-${seq}`, status: 'pending' };
      createKeys.set(input.idempotencyKey, res);
      comments.set(res.post_id, []);
      return res;
    },

    async deleteMyPost({ post }): Promise<{ ok: boolean }> {
      const p = posts.find((x) => x.id === post);
      if (p) p.status = 'removed';
      return { ok: true };
    },

    async moderateContent(): Promise<void> {
      // mock: ateşle-unut, yut
    },

    async addComment({ post, body, parent = null, idempotencyKey }): Promise<AddCommentResult> {
      const prev = commentKeys.get(idempotencyKey);
      if (prev) return prev;
      seq += 1;
      const id = `newcomment-${seq}`;
      const list = comments.get(post) ?? [];
      list.push({
        id,
        post_id: post,
        author: { id: 'me', display_name: 'Ben', handle: 'ben', avatar_url: null, verified: false },
        parent_id: parent,
        body,
        status: 'pending',
        created_at: `2026-11-03T13:0${seq % 10}:00.000Z`,
        reply_count: 0,
        can_delete: true,
      });
      comments.set(post, list);
      const p = posts.find((x) => x.id === post);
      if (p) p.stats.comments += 1;
      const res: AddCommentResult = { comment_id: id, status: 'pending' };
      commentKeys.set(idempotencyKey, res);
      return res;
    },

    async listComments({ post, cursor = null, limit = 30 }): Promise<CommentPage> {
      const list = (comments.get(post) ?? []).filter((c) => c.status !== 'removed');
      const start = cursor ? Number(cursor) : 0;
      const slice = list.slice(start, start + limit);
      const nextStart = start + limit;
      return {
        items: slice.map((c) => ({ ...c })),
        next_cursor: nextStart < list.length ? String(nextStart) : null,
      };
    },

    async deleteMyComment({ comment }): Promise<{ ok: boolean }> {
      for (const [postId, list] of comments) {
        const c = list.find((x) => x.id === comment);
        if (c) {
          c.status = 'removed';
          const p = posts.find((x) => x.id === postId);
          if (p && p.stats.comments > 0) p.stats.comments -= 1;
          return { ok: true };
        }
      }
      return { ok: false };
    },

    async didIt({ post, minutes = null, idempotencyKey }): Promise<ActivityLogResult> {
      const prev = activityKeys.get(idempotencyKey);
      if (prev) return prev;
      const p = posts.find((x) => x.id === post);
      const card = p?.activity_card ?? null;
      const type: ActivityType = card?.type ?? 'diger';
      const mins = minutes ?? card?.minutes ?? 0;
      seq += 1;
      const res: ActivityLogResult = {
        activity_log_id: `log-${seq}`,
        kcal_est: estimateActivityKcal(type, mins),
      };
      activityKeys.set(idempotencyKey, res);
      if (p) p.stats.did_it += 1;
      activityLogs.push({
        id: res.activity_log_id,
        type,
        minutes: mins,
        distance_km: card?.distance_km ?? null,
        kcal_est: res.kcal_est,
        source: 'post',
        logged_at: '2026-11-03T13:30:00.000Z',
      });
      return res;
    },

    async logActivity({ type, minutes, distanceKm = null, idempotencyKey }): Promise<ActivityLogResult> {
      const prev = activityKeys.get(idempotencyKey);
      if (prev) return prev;
      seq += 1;
      const res: ActivityLogResult = {
        activity_log_id: `log-${seq}`,
        kcal_est: estimateActivityKcal(type, minutes),
      };
      activityKeys.set(idempotencyKey, res);
      activityLogs.push({
        id: res.activity_log_id,
        type,
        minutes,
        distance_km: distanceKm,
        kcal_est: res.kcal_est,
        source: 'manual',
        logged_at: '2026-11-03T13:30:00.000Z',
      });
      return res;
    },

    async getMyDayActivity(): Promise<DayActivity> {
      return {
        items: activityLogs.map((a) => ({ ...a })),
        total_kcal_est: activityLogs.reduce((s, a) => s + a.kcal_est, 0),
        total_minutes: activityLogs.reduce((s, a) => s + a.minutes, 0),
      };
    },

    async listSocialNotifications({ cursor = null }: { cursor?: string | null } = {}): Promise<NotificationPage> {
      const start = cursor ? Number(cursor) : 0;
      const limit = 20;
      const slice = notifications.slice(start, start + limit);
      const nextStart = start + limit;
      return {
        items: slice.map((n) => ({ ...n })),
        next_cursor: nextStart < notifications.length ? String(nextStart) : null,
        unread: notifications.filter((n) => n.read_at == null).length,
      };
    },

    async markSocialNotificationsRead(): Promise<void> {
      for (const n of notifications) {
        if (n.read_at == null) n.read_at = '2026-11-03T12:30:00.000Z';
      }
    },

    // ── G11 ──────────────────────────────────────────────────────────────
    async searchProducts({ q, limit = 12 }): Promise<ProductSearchResult> {
      if (options.productSearchUnavailable) return { available: false, items: [] };
      const needle = q.trim().toLowerCase();
      if (needle.length < 2) return { available: true, items: [] };
      const items = SAMPLE_PRODUCTS.filter((p) => p.name.toLowerCase().includes(needle)).slice(0, limit);
      // Eşleşme yoksa da sahte 5 ürünü göster (mock: her zaman dolu).
      return { available: true, items: items.length ? items : SAMPLE_PRODUCTS.slice(0, limit) };
    },

    async updateMyPost({ post, body }): Promise<UpdatePostResult> {
      if (options.postEditUnavailable) return { available: false, ok: false, status: 'published' };
      const p = posts.find((x) => x.id === post);
      if (!p) return { available: true, ok: false, status: 'published' };
      p.body = body;
      // Yayındaki gönderinin gövdesi değişince yeniden denetime düşer.
      if (p.status === 'published') p.status = 'pending';
      return { available: true, ok: true, status: p.status };
    },
  };
}

/** __DEV__ deneme ekranı için varsayılan örnek istemci. */
export const mockKesfetClient = createMockKesfetClient({ withActivityPost: true });
