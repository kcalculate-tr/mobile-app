// Keşfet gerçek RPC istemcisi — Supabase `security definer` RPC'lerini çağırır.
// Yetki/kota SUNUCUDA denetlenir (bayrak yetki değildir). Hata → throw; store
// yakalar ve kullanıcıya geri bildirir.
//
// NOT: `core/supabase` üst düzeyde import EDİLMEZ — o modül yüklenince Supabase
// istemcisi kurulur ve Node (tsx --test) ortamında oturum yenileme `window`
// arar. Bu yüzden istemci yalnız bir RPC gerçekten çağrılınca tembel yüklenir;
// testler zaten mock enjekte ettiği için bu yol koşulmaz.
//
// Store/hook'lar doğrudan buna değil, `getKesfetClient()` üzerinden bağlanır.
import type {
  AddCommentResult,
  AddToDayResult,
  ActivityLogResult,
  CommentPage,
  CreatePostInput,
  CreatePostResult,
  DayActivity,
  FeedPage,
  FeedPost,
  KesfetClient,
  NotificationPage,
  ProductSearchItem,
  ProductSearchResult,
  RateLimitedResult,
  ReactResult,
  UpdatePostResult,
} from './types';
import { toServerMealType } from '../../core/meal/mealType';

type SupabaseModule = typeof import('../../core/supabase');
function sb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../../core/supabase') as SupabaseModule).getSupabaseClient();
}

function rpcError(name: string, error: { message: string }): never {
  throw new Error(`${name}: ${error.message}`);
}

// Canlıda HENÜZ olmayan RPC'ler (S1 yazar) için: "fonksiyon bulunamadı" hatasını
// ayırt et → özellik sessizce gizlenir (G11-CONTRACT: "RPC bulunamazsa gizlenir").
// PostgREST şema önbelleğinde yoksa `PGRST202`; Postgres undefined_function `42883`.
function isMissingFunction(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  if (code === 'PGRST202' || code === '42883') return true;
  const m = (error.message ?? '').toLowerCase();
  return m.includes('could not find the function') || m.includes('does not exist');
}

function toNum(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeProduct(raw: Partial<ProductSearchItem> & { id: string }): ProductSearchItem {
  return {
    id: String(raw.id),
    name: typeof raw.name === 'string' ? raw.name : '',
    image_url: raw.image_url ?? null,
    kcal: toNum(raw.kcal),
    protein_g: toNum(raw.protein_g),
    carbs_g: toNum(raw.carbs_g),
    fat_g: toNum(raw.fat_g),
  };
}

// Sunucu eski (G7 öncesi) şekilde döndürse bile G8 alanlarını güvenli
// varsayılanlarla doldur — UI her zaman tam bir FeedPost görür.
function normalizePost(raw: Partial<FeedPost> & { id: string }): FeedPost {
  const stats = raw.stats ?? { likes: 0, saves: 0, adds: 0, comments: 0, did_it: 0 };
  const me = raw.me ?? { liked: false, saved: false, is_author: false };
  return {
    ...(raw as FeedPost),
    stats: {
      likes: stats.likes ?? 0,
      saves: stats.saves ?? 0,
      adds: stats.adds ?? 0,
      comments: stats.comments ?? 0,
      did_it: stats.did_it ?? 0,
    },
    me: {
      liked: me.liked ?? false,
      saved: me.saved ?? false,
      is_author: me.is_author ?? false,
    },
    post_type: raw.post_type ?? 'ogun',
    status: raw.status ?? 'published',
    activity_card: raw.activity_card ?? null,
  };
}

export const realKesfetClient: KesfetClient = {
  async getFeed({ tab, lang, cursor = null, limit = 20 }): Promise<FeedPage> {
    const { data, error } = await sb().rpc('get_feed', {
      p_tab: tab,
      p_lang: lang,
      p_cursor: cursor,
      p_limit: limit,
    });
    if (error) rpcError('get_feed', error);
    const page = (data ?? {}) as Partial<FeedPage>;
    const items = Array.isArray(page.items) ? page.items : [];
    return {
      items: items.map((p) => normalizePost(p as Partial<FeedPost> & { id: string })),
      next_cursor: page.next_cursor ?? null,
    };
  },

  async getPost({ post }): Promise<FeedPost | null> {
    const { data, error } = await sb().rpc('get_post', { p_post: post });
    if (error) rpcError('get_post', error);
    if (data == null) return null;
    return normalizePost(data as Partial<FeedPost> & { id: string });
  },

  async reactPost({ post, kind, on }): Promise<ReactResult> {
    const { data, error } = await sb().rpc('react_post', {
      p_post: post,
      p_kind: kind,
      p_on: on,
    });
    if (error) rpcError('react_post', error);
    return data as ReactResult;
  },

  async addPostMealToDay({ post, mealType, portion, idempotencyKey }): Promise<AddToDayResult> {
    const { data, error } = await sb().rpc('add_post_meal_to_day', {
      p_post: post,
      p_meal_type: toServerMealType(mealType),
      p_portion: portion,
      p_idempotency_key: idempotencyKey,
    });
    if (error) rpcError('add_post_meal_to_day', error);
    return data as AddToDayResult;
  },

  async removeConsumption({ consumption }): Promise<void> {
    // Doğrudan tablo silme (RPC değil): RLS yalnız kendi satırını siler. Keşfet'in
    // loglama yolu TrackerScreen ile aynı `meal_consumptions` tablosunu kullanır.
    const { error } = await sb().from('meal_consumptions').delete().eq('id', consumption);
    if (error) rpcError('remove_consumption', error);
  },

  async reportContent({ targetType, target, reason }): Promise<void> {
    const { error } = await sb().rpc('report_content', {
      p_target_type: targetType,
      p_target: target,
      p_reason: reason,
    });
    if (error) rpcError('report_content', error);
  },

  async blockUser({ user, on }): Promise<void> {
    const { error } = await sb().rpc('block_user', {
      p_user: user,
      p_on: on,
    });
    if (error) rpcError('block_user', error);
  },

  // ── G8 ────────────────────────────────────────────────────────────────────
  async createPost(input: CreatePostInput): Promise<CreatePostResult | RateLimitedResult> {
    const { data, error } = await sb().rpc('create_post', {
      p_type: input.type,
      p_body: input.body,
      p_lang: input.lang,
      p_media: input.media,
      p_meal_card: input.mealCard,
      p_activity_card: input.activityCard,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error) rpcError('create_post', error);
    return data as CreatePostResult | RateLimitedResult;
  },

  async deleteMyPost({ post }): Promise<{ ok: boolean }> {
    const { data, error } = await sb().rpc('delete_my_post', { p_post: post });
    if (error) rpcError('delete_my_post', error);
    return (data ?? { ok: true }) as { ok: boolean };
  },

  async moderateContent({ targetType, targetId }): Promise<void> {
    // Ateşle-unut: hata sunucuda pending kalıp pg_cron ile yeniden denenir.
    const { error } = await sb().functions.invoke('moderate-content', {
      body: { target_type: targetType, target_id: targetId },
    });
    if (error) throw new Error(`moderate-content: ${error.message}`);
  },

  async addComment({ post, body, parent = null, idempotencyKey }): Promise<AddCommentResult> {
    const { data, error } = await sb().rpc('add_comment', {
      p_post: post,
      p_body: body,
      p_parent: parent,
      p_idempotency_key: idempotencyKey,
    });
    if (error) rpcError('add_comment', error);
    return data as AddCommentResult;
  },

  async listComments({ post, cursor = null, limit = 30 }): Promise<CommentPage> {
    const { data, error } = await sb().rpc('list_comments', {
      p_post: post,
      p_cursor: cursor,
      p_limit: limit,
    });
    if (error) rpcError('list_comments', error);
    const page = (data ?? {}) as Partial<CommentPage>;
    return {
      items: Array.isArray(page.items) ? page.items : [],
      next_cursor: page.next_cursor ?? null,
    };
  },

  async deleteMyComment({ comment }): Promise<{ ok: boolean }> {
    const { data, error } = await sb().rpc('delete_my_comment', { p_comment: comment });
    if (error) rpcError('delete_my_comment', error);
    return (data ?? { ok: true }) as { ok: boolean };
  },

  async didIt({ post, minutes = null, idempotencyKey }): Promise<ActivityLogResult> {
    const { data, error } = await sb().rpc('did_it', {
      p_post: post,
      p_minutes: minutes,
      p_idempotency_key: idempotencyKey,
    });
    if (error) rpcError('did_it', error);
    return data as ActivityLogResult;
  },

  async logActivity({ type, minutes, distanceKm = null, note = null, idempotencyKey }): Promise<ActivityLogResult> {
    const { data, error } = await sb().rpc('log_activity', {
      p_type: type,
      p_minutes: minutes,
      p_distance_km: distanceKm,
      p_note: note,
      p_idempotency_key: idempotencyKey,
    });
    if (error) rpcError('log_activity', error);
    return data as ActivityLogResult;
  },

  async getMyDayActivity(params): Promise<DayActivity> {
    const { data, error } = await sb().rpc('get_my_day_activity', {
      p_day: params?.day ?? null,
    });
    if (error) rpcError('get_my_day_activity', error);
    const d = (data ?? {}) as Partial<DayActivity>;
    return {
      items: Array.isArray(d.items) ? d.items : [],
      total_kcal_est: d.total_kcal_est ?? 0,
      total_minutes: d.total_minutes ?? 0,
    };
  },

  async listSocialNotifications(params): Promise<NotificationPage> {
    const { data, error } = await sb().rpc('list_social_notifications', {
      p_cursor: params?.cursor ?? null,
    });
    if (error) rpcError('list_social_notifications', error);
    const page = (data ?? {}) as Partial<NotificationPage>;
    return {
      items: Array.isArray(page.items) ? page.items : [],
      next_cursor: page.next_cursor ?? null,
      unread: page.unread ?? 0,
    };
  },

  async markSocialNotificationsRead(params): Promise<void> {
    const { error } = await sb().rpc('mark_social_notifications_read', {
      p_until: params?.until ?? null,
    });
    if (error) rpcError('mark_social_notifications_read', error);
  },

  // ── G11 ────────────────────────────────────────────────────────────────────
  async searchProducts({ q, limit = 12 }): Promise<ProductSearchResult> {
    const { data, error } = await sb().rpc('search_products', { p_q: q, p_limit: limit });
    if (error) {
      // RPC canlıda yok → özellik gizlenir. Diğer hata → sakin boş sonuç.
      if (isMissingFunction(error)) return { available: false, items: [] };
      return { available: true, items: [] };
    }
    const items = Array.isArray((data as { items?: unknown })?.items)
      ? ((data as { items: Array<Partial<ProductSearchItem> & { id: string }> }).items)
      : [];
    return { available: true, items: items.map(normalizeProduct) };
  },

  async updateMyPost({ post, body }): Promise<UpdatePostResult> {
    const { data, error } = await sb().rpc('update_my_post', { p_post: post, p_body: body });
    if (error) {
      if (isMissingFunction(error)) return { available: false, ok: false, status: 'published' };
      rpcError('update_my_post', error);
    }
    const d = (data ?? {}) as { ok?: boolean; status?: UpdatePostResult['status'] };
    return { available: true, ok: d.ok ?? true, status: d.status ?? 'published' };
  },
};

// Etkin istemci — varsayılan gerçek RPC. __DEV__ ekranı/testler mock ile değiştirir.
let activeClient: KesfetClient = realKesfetClient;

export function getKesfetClient(): KesfetClient {
  return activeClient;
}

export function setKesfetClient(client: KesfetClient): void {
  activeClient = client;
}

export function resetKesfetClient(): void {
  activeClient = realKesfetClient;
}
