// Keşfet zustand store — sekme, imleç sayfalama, yenileme, iyimser beğen/kaydet
// ve idempotent "Günüme ekle". Veri `getKesfetClient()` üzerinden gelir; testler
// ve __DEV__ ekranı mock enjekte eder. Hiçbir canlı ekran buna bağlı DEĞİL.
import { create } from 'zustand';

import { getKesfetClient } from './client';
import type {
  AddToDayResult,
  FeedPost,
  FeedStats,
  FeedTab,
  MealType,
  ReactionKind,
  ReportTargetType,
} from './types';

const PAGE_LIMIT = 20;

// Aynı idempotency anahtarıyla eşzamanlı "ekle" çağrılarını tek RPC'ye indirger
// (çift dokunma koruması). Store state'i dışında tutulur çünkü Promise taşır.
const inFlightAdds = new Map<string, Promise<AddToDayResult>>();

interface KesfetState {
  tab: FeedTab;
  posts: FeedPost[];
  cursor: string | null;
  hasMore: boolean;
  loading: boolean; // ilk yükleme
  refreshing: boolean; // pull-to-refresh
  loadingMore: boolean; // sonraki sayfa
  error: string | null;
  // idempotency: anahtar → consumption_id (oturum içi tekrar koruması)
  addedKeys: Record<string, string>;

  setTab: (tab: FeedTab) => Promise<void>;
  load: () => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  react: (postId: string, kind: ReactionKind, on: boolean) => Promise<void>;
  addToDay: (
    postId: string,
    mealType: MealType,
    portion: number,
    idempotencyKey: string,
  ) => Promise<string | null>;
  // Şikayet: RPC'ye iletir; başarıda true. Liste değişmez (moderasyon sunucuda).
  report: (targetType: ReportTargetType, target: string, reason: string) => Promise<boolean>;
  // Engelle: iyimser — bu yazarın tüm gönderileri akıştan ANINDA düşer, sonra RPC.
  // Hata olursa liste eski hâline döner.
  blockAuthor: (userId: string) => Promise<boolean>;
  reset: () => void;
}

function applyReaction(stats: FeedStats, kind: ReactionKind, on: boolean): FeedStats {
  const delta = on ? 1 : -1;
  if (kind === 'like') return { ...stats, likes: Math.max(0, stats.likes + delta) };
  return { ...stats, saves: Math.max(0, stats.saves + delta) };
}

export const useKesfetStore = create<KesfetState>((set, get) => ({
  tab: 'for_you',
  posts: [],
  cursor: null,
  hasMore: true,
  loading: false,
  refreshing: false,
  loadingMore: false,
  error: null,
  addedKeys: {},

  setTab: async (tab) => {
    if (get().tab === tab) return;
    set({ tab, posts: [], cursor: null, hasMore: true, error: null });
    await get().load();
  },

  load: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const page = await getKesfetClient().getFeed({ tab: get().tab, lang: 'tr', limit: PAGE_LIMIT });
      set({ posts: page.items, cursor: page.next_cursor, hasMore: page.next_cursor != null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'load_failed' });
    } finally {
      set({ loading: false });
    }
  },

  loadMore: async () => {
    const { loadingMore, hasMore, cursor, posts } = get();
    if (loadingMore || !hasMore || cursor == null) return;
    set({ loadingMore: true });
    try {
      const page = await getKesfetClient().getFeed({
        tab: get().tab,
        lang: 'tr',
        cursor,
        limit: PAGE_LIMIT,
      });
      // Aynı id'yi iki kez eklemeyi önle (imleç kayması güvenliği).
      const seen = new Set(posts.map((p) => p.id));
      const fresh = page.items.filter((p) => !seen.has(p.id));
      set({
        posts: [...posts, ...fresh],
        cursor: page.next_cursor,
        hasMore: page.next_cursor != null,
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'load_more_failed' });
    } finally {
      set({ loadingMore: false });
    }
  },

  refresh: async () => {
    if (get().refreshing) return;
    set({ refreshing: true, error: null });
    try {
      const page = await getKesfetClient().getFeed({ tab: get().tab, lang: 'tr', limit: PAGE_LIMIT });
      set({ posts: page.items, cursor: page.next_cursor, hasMore: page.next_cursor != null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'refresh_failed' });
    } finally {
      set({ refreshing: false });
    }
  },

  react: async (postId, kind, on) => {
    const before = get().posts.find((p) => p.id === postId);
    if (!before) return;
    // İyimser: anında güncelle.
    set({
      posts: get().posts.map((p) =>
        p.id === postId
          ? {
              ...p,
              me: { ...p.me, [kind === 'like' ? 'liked' : 'saved']: on },
              stats: applyReaction(p.stats, kind, on),
            }
          : p,
      ),
    });
    try {
      const res = await getKesfetClient().reactPost({ post: postId, kind, on });
      // Sunucu gerçeğiyle uzlaştır.
      set({
        posts: get().posts.map((p) =>
          p.id === postId ? { ...p, me: res.me, stats: res.stats } : p,
        ),
      });
    } catch (e) {
      // Başarısız → iyimser değişikliği geri al.
      set({
        posts: get().posts.map((p) =>
          p.id === postId ? { ...p, me: before.me, stats: before.stats } : p,
        ),
        error: e instanceof Error ? e.message : 'react_failed',
      });
    }
  },

  addToDay: async (postId, mealType, portion, idempotencyKey) => {
    // Oturum içinde bu anahtar zaten yazıldıysa yeni RPC atma.
    const done = get().addedKeys[idempotencyKey];
    if (done) return done;
    let p = inFlightAdds.get(idempotencyKey);
    if (!p) {
      p = getKesfetClient().addPostMealToDay({ post: postId, mealType, portion, idempotencyKey });
      inFlightAdds.set(idempotencyKey, p);
    }
    try {
      const res = await p;
      set((s) => ({
        addedKeys: { ...s.addedKeys, [idempotencyKey]: res.consumption_id },
        posts: s.posts.map((post) =>
          post.id === postId ? { ...post, stats: { ...post.stats, adds: post.stats.adds + 1 } } : post,
        ),
      }));
      return res.consumption_id;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'add_failed' });
      return null;
    } finally {
      inFlightAdds.delete(idempotencyKey);
    }
  },

  report: async (targetType, target, reason) => {
    try {
      await getKesfetClient().reportContent({ targetType, target, reason });
      return true;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'report_failed' });
      return false;
    }
  },

  blockAuthor: async (userId) => {
    const prev = get().posts;
    // İyimser: yazarın gönderilerini hemen çıkar (akıştan anında düşer).
    set({ posts: prev.filter((p) => p.author.id !== userId) });
    try {
      await getKesfetClient().blockUser({ user: userId, on: true });
      return true;
    } catch (e) {
      // Başarısız → listeyi geri yükle.
      set({ posts: prev, error: e instanceof Error ? e.message : 'block_failed' });
      return false;
    }
  },

  reset: () => {
    set({
      tab: 'for_you',
      posts: [],
      cursor: null,
      hasMore: true,
      loading: false,
      refreshing: false,
      loadingMore: false,
      error: null,
      addedKeys: {},
    });
  },
}));
