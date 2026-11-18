// G63-S1 — Mesajlar okunmamış rozeti (Keşfet başlığı). Bağlantı yoksa çek-yenile + ön plana gelişte yenile;
// Realtime açıkken gelen her mesaj olayı yeniden sayar. Bayrak kapalıyken hiç çağrılmaz (çağıran denetler).
import { create } from 'zustand';
import { getDmClient } from './client';

interface DmBadgeState {
  unread: number;
  requests: number;
  refresh: () => Promise<void>;
  reset: () => void;
}

export const useDmBadge = create<DmBadgeState>((set) => ({
  unread: 0,
  requests: 0,
  refresh: async () => {
    try {
      const r = await getDmClient().unreadCount();
      set({ unread: r.unread, requests: r.requests });
    } catch {
      // Sessiz: rozet bir sonraki odakta yeniden denenir.
    }
  },
  reset: () => set({ unread: 0, requests: 0 }),
}));
