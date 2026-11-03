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
  AddToDayResult,
  FeedPage,
  FeedPost,
  KesfetClient,
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
    return {
      items: Array.isArray(page.items) ? page.items : [],
      next_cursor: page.next_cursor ?? null,
    };
  },

  async getPost({ post }): Promise<FeedPost | null> {
    const { data, error } = await sb().rpc('get_post', { p_post: post });
    if (error) rpcError('get_post', error);
    return (data ?? null) as FeedPost | null;
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
