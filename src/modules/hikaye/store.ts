// G59-S1 — Hikâye tepsisi deposu (Keşfet tepsisi + profil halkaları ortak). Görüldü işareti iyimser
// (tepsideki görülmemiş sayısı hemen düşer, sunucu çağrısı arkada). Paylaşım sonrası `refresh()`.
import { create } from 'zustand';
import { getStoryClient } from './client';
import { markSeenInTray, orderTray } from './rules';
import type { TrayItem } from './types';

interface StoryTrayState {
  items: TrayItem[];
  loading: boolean;
  loaded: boolean;
  error: boolean;
  /** Son başarılı paylaşım kimliği (profil halkaları yeniden okur). */
  postedAt: number;
  refresh: () => Promise<void>;
  /** Görüntüleyici bir kişinin `n` hikâyesini ilk kez gördü. */
  markSeen: (userId: string, n: number) => void;
  notePosted: () => void;
  reset: () => void;
}

let seq = 0;

export const useStoryTray = create<StoryTrayState>((set, get) => ({
  items: [],
  loading: false,
  loaded: false,
  error: false,
  postedAt: 0,
  async refresh() {
    const mine = ++seq;
    set({ loading: true, error: false });
    try {
      const items = orderTray(await getStoryClient().getTray());
      if (mine === seq) set({ items, loading: false, loaded: true });
    } catch {
      if (mine === seq) set({ loading: false, loaded: true, error: true });
    }
  },
  markSeen(userId, n) {
    if (n <= 0) return;
    set({ items: orderTray(markSeenInTray(get().items, userId, n)) });
  },
  notePosted() {
    set({ postedAt: Date.now() });
    void get().refresh();
  },
  reset() {
    seq++;
    set({ items: [], loading: false, loaded: false, error: false });
  },
}));

/** Görüntüleyiciye verilecek kişi sırası: tepsideki hikâyesi olanlar (ben dahil, hikâyem varsa). */
export function viewerQueue(items: readonly TrayItem[]): string[] {
  return items.filter((i) => i.story_count > 0).map((i) => i.user_id);
}
