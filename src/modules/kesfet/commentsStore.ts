// Yorum store'u — bir gönderinin yorumları. İyimser ekleme (anında listede
// görünür, sonra sunucu onayı; hata → geri al), sayfalama, kendi yorumunu silme.
// Veri `getKesfetClient()` üzerinden gelir; testler ve __DEV__ ekranı mock enjekte
// eder. Hiçbir canlı ekran buna bağlı DEĞİL (yalnız `kesfet_yorum` açıkken).
import { create } from 'zustand';

import { getKesfetClient } from './client';
import type { Comment, CommentAuthor } from './types';

const PAGE_LIMIT = 30;

interface CommentsState {
  postId: string | null;
  items: Comment[];
  cursor: string | null;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  submitting: boolean;
  error: string | null;

  open: (postId: string) => Promise<void>;
  loadMore: () => Promise<void>;
  // İyimser ekle: geçici yorum anında listeye düşer; sunucu onayında gerçek
  // id/durumla değişir, hata olursa kaldırılır. Dönen: başarıda comment_id.
  add: (
    body: string,
    author: CommentAuthor,
    parentId: string | null,
    idempotencyKey: string,
  ) => Promise<string | null>;
  remove: (commentId: string) => Promise<boolean>;
  report: (commentId: string, reason: string) => Promise<boolean>;
  blockAuthor: (userId: string) => Promise<boolean>;
  reset: () => void;
}

export const useCommentsStore = create<CommentsState>((set, get) => ({
  postId: null,
  items: [],
  cursor: null,
  hasMore: true,
  loading: false,
  loadingMore: false,
  submitting: false,
  error: null,

  open: async (postId) => {
    set({ postId, items: [], cursor: null, hasMore: true, loading: true, error: null });
    try {
      const page = await getKesfetClient().listComments({ post: postId, limit: PAGE_LIMIT });
      set({ items: page.items, cursor: page.next_cursor, hasMore: page.next_cursor != null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'comments_load_failed' });
    } finally {
      set({ loading: false });
    }
  },

  loadMore: async () => {
    const { loadingMore, hasMore, cursor, postId, items } = get();
    if (loadingMore || !hasMore || cursor == null || postId == null) return;
    set({ loadingMore: true });
    try {
      const page = await getKesfetClient().listComments({ post: postId, cursor, limit: PAGE_LIMIT });
      const seen = new Set(items.map((c) => c.id));
      const fresh = page.items.filter((c) => !seen.has(c.id));
      set({ items: [...items, ...fresh], cursor: page.next_cursor, hasMore: page.next_cursor != null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'comments_load_more_failed' });
    } finally {
      set({ loadingMore: false });
    }
  },

  add: async (body, author, parentId, idempotencyKey) => {
    const postId = get().postId;
    if (postId == null) return null;
    const tempId = `temp-${idempotencyKey}`;
    const temp: Comment = {
      id: tempId,
      post_id: postId,
      author,
      parent_id: parentId,
      body,
      status: 'pending',
      created_at: '',
      reply_count: 0,
      can_delete: true,
    };
    // İyimser: sona ekle (eski → yeni sıralama).
    set((s) => ({ items: [...s.items, temp], submitting: true, error: null }));
    try {
      const res = await getKesfetClient().addComment({ post: postId, body, parent: parentId, idempotencyKey });
      // Geçici yorumu gerçek id + durumla değiştir.
      set((s) => ({
        items: s.items.map((c) => (c.id === tempId ? { ...c, id: res.comment_id, status: res.status } : c)),
      }));
      // Yayın öncesi AI denetimi (ateşle-unut).
      getKesfetClient().moderateContent({ targetType: 'comment', targetId: res.comment_id }).catch(() => {});
      return res.comment_id;
    } catch (e) {
      // Geri al: geçici yorumu kaldır.
      set((s) => ({
        items: s.items.filter((c) => c.id !== tempId),
        error: e instanceof Error ? e.message : 'comment_add_failed',
      }));
      return null;
    } finally {
      set({ submitting: false });
    }
  },

  remove: async (commentId) => {
    const prev = get().items;
    // İyimser: hemen çıkar.
    set({ items: prev.filter((c) => c.id !== commentId) });
    try {
      await getKesfetClient().deleteMyComment({ comment: commentId });
      return true;
    } catch (e) {
      set({ items: prev, error: e instanceof Error ? e.message : 'comment_delete_failed' });
      return false;
    }
  },

  report: async (commentId, reason) => {
    try {
      await getKesfetClient().reportContent({ targetType: 'comment', target: commentId, reason });
      return true;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'comment_report_failed' });
      return false;
    }
  },

  blockAuthor: async (userId) => {
    const prev = get().items;
    set({ items: prev.filter((c) => c.author.id !== userId) });
    try {
      await getKesfetClient().blockUser({ user: userId, on: true });
      return true;
    } catch (e) {
      set({ items: prev, error: e instanceof Error ? e.message : 'comment_block_failed' });
      return false;
    }
  },

  reset: () => {
    set({
      postId: null,
      items: [],
      cursor: null,
      hasMore: true,
      loading: false,
      loadingMore: false,
      submitting: false,
      error: null,
    });
  },
}));
