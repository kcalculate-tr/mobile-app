// G53-S1 md.1/md.2 — Oturumdaki kullanıcının KENDİ profil kimliği (avatar, handle, ad) için küçük ortak depo.
// Keşfet üst çubuğu kısayolu buradan okur; "+" rozetiyle foto değişince (Profil sekmesi / kendi açık profil)
// buraya yazılır → Keşfet'teki avatar da anında güncellenir. Kaynak: profiles satırı (mevcut sorgularla aynı).
import { create } from 'zustand';
import { getSupabaseClient } from '../../core/supabase';

export interface MyProfile {
  userId: string | null;
  avatarUrl: string | null;
  handle: string | null;
  name: string | null;
}

interface MyProfileState extends MyProfile {
  setAvatar: (url: string | null) => void;
  setIdentity: (p: Partial<MyProfile> & { userId: string }) => void;
  load: (userId: string, fallbackName: string | null) => Promise<void>;
  reset: () => void;
}

const EMPTY: MyProfile = { userId: null, avatarUrl: null, handle: null, name: null };

export const useMyProfileStore = create<MyProfileState>((set, get) => ({
  ...EMPTY,
  setAvatar: (url) => set({ avatarUrl: url }),
  setIdentity: (p) => set((s) => ({ ...(s.userId === p.userId ? s : EMPTY), ...p })),
  load: async (userId, fallbackName) => {
    if (get().userId !== userId) set({ ...EMPTY, userId, name: fallbackName });
    try {
      const { data } = await getSupabaseClient()
        .from('profiles')
        .select('avatar_url, handle, full_name')
        .eq('id', userId)
        .maybeSingle();
      // maybeSingle tek satır (ya da null) döner; beklenmeyen biçimde (dizi) mevcut kimliği ezme.
      if (get().userId !== userId || !data || Array.isArray(data)) return;
      const row = data as { avatar_url?: string | null; handle?: string | null; full_name?: string | null };
      set({
        avatarUrl: row.avatar_url ?? null,
        handle: row.handle ?? null,
        name: String(row.full_name ?? '').trim() || fallbackName,
      });
    } catch {
      // okunamadı — baş harf / boş daire gösterilir.
    }
  },
  reset: () => set(EMPTY),
}));
