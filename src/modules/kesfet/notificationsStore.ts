// Sosyal bildirim store'u — liste, okunmamış sayısı (zil rozeti), okundu
// işaretleme. `getKesfetClient()` üzerinden; testler/__DEV__ mock enjekte eder.
// Yalnız `sosyal_bildirim` açıkken kullanılır; hiçbir canlı ekran buna bağlı değil.
import { create } from 'zustand';

import { getKesfetClient } from './client';
import type { SocialNotification } from './types';

interface NotificationsState {
  items: SocialNotification[];
  cursor: string | null;
  hasMore: boolean;
  unread: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;

  // Rozet için hafif sayaç çekimi (listeyi doldurmadan). Zil açılışında load().
  refreshUnread: () => Promise<void>;
  load: () => Promise<void>;
  loadMore: () => Promise<void>;
  // İyimser: rozet anında sıfırlanır + listedeki read_at set edilir, sonra RPC.
  markAllRead: () => Promise<void>;
  reset: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  cursor: null,
  hasMore: true,
  unread: 0,
  loading: false,
  loadingMore: false,
  error: null,

  refreshUnread: async () => {
    try {
      const page = await getKesfetClient().listSocialNotifications();
      set({ unread: page.unread });
    } catch {
      // sessiz — rozet yoksa yoktur
    }
  },

  load: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const page = await getKesfetClient().listSocialNotifications();
      set({
        items: page.items,
        cursor: page.next_cursor,
        hasMore: page.next_cursor != null,
        unread: page.unread,
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'notifications_load_failed' });
    } finally {
      set({ loading: false });
    }
  },

  loadMore: async () => {
    const { loadingMore, hasMore, cursor, items } = get();
    if (loadingMore || !hasMore || cursor == null) return;
    set({ loadingMore: true });
    try {
      const page = await getKesfetClient().listSocialNotifications({ cursor });
      const seen = new Set(items.map((n) => n.id));
      const fresh = page.items.filter((n) => !seen.has(n.id));
      set({ items: [...items, ...fresh], cursor: page.next_cursor, hasMore: page.next_cursor != null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'notifications_load_more_failed' });
    } finally {
      set({ loadingMore: false });
    }
  },

  markAllRead: async () => {
    const prev = get().items;
    const prevUnread = get().unread;
    if (prevUnread === 0) return;
    // İyimser: hepsini okundu yap.
    const stamp = '';
    set({
      unread: 0,
      items: prev.map((n) => (n.read_at == null ? { ...n, read_at: n.read_at ?? stamp } : n)),
    });
    try {
      await getKesfetClient().markSocialNotificationsRead();
    } catch (e) {
      // Geri al.
      set({ items: prev, unread: prevUnread, error: e instanceof Error ? e.message : 'mark_read_failed' });
    }
  },

  reset: () => {
    set({
      items: [],
      cursor: null,
      hasMore: true,
      unread: 0,
      loading: false,
      loadingMore: false,
      error: null,
    });
  },
}));
