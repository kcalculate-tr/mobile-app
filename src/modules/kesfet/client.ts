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
  RateLimitedResult,
  ReactResult,
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
