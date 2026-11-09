// G18-S1 — kalıcı "ilk 60 saniye" bayrakları (ORTAK #8, SON_HAL Tur 26).
//
// Kaynaklar: AsyncStorage (`@kcal_onb_first_v1`) + profil (`profiles.onboarding_state`,
// migration 20261108000100 — CANLIYA UYGULANACAK). Kolon yoksa / ağ hatası →
// yalnız cihaz; hiçbir hata kullanıcıya yansımaz. Birleştirme `mergeSynced` (ileri
// durum kazanır). "Açılış görüldü" yalnız cihazda (`@kcal_onb_open_seen`).
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSupabaseClient } from '../../../core/supabase';
import {
  EMPTY_SYNCED,
  markSeen,
  mergeSynced,
  parseSynced,
  sameSynced,
  skipAll,
  type OrientStep,
  type ProfileCardState,
  type SyncedState,
} from './state';

export const ONB_FIRST_KEY = '@kcal_onb_first_v1';
export const OPEN_SEEN_KEY = '@kcal_onb_open_seen';

interface OnbFirstStore {
  hydrated: boolean;
  userId: string | null;
  synced: SyncedState;
  /** Bekleyen "Profil hazır" sahnesi (Takibe başla sonucundan). */
  celebrate: { kcal: number | null } | null;
  hydrate: (userId: string | null) => Promise<void>;
  setCard: (s: ProfileCardState) => void;
  startOrient: () => void;
  seen: (step: OrientStep) => void;
  skip: () => void;
  queueCelebrate: (kcal: number | null) => void;
  clearCelebrate: () => void;
  /** YALNIZ test/vitrin. */
  _reset: (s?: SyncedState) => void;
}

async function readRemote(userId: string): Promise<SyncedState | null> {
  try {
    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .select('onboarding_state')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return parseSynced((data as { onboarding_state?: unknown }).onboarding_state);
  } catch {
    return null;
  }
}

async function writeRemote(userId: string, s: SyncedState): Promise<void> {
  try {
    await getSupabaseClient().from('profiles').update({ onboarding_state: s }).eq('id', userId);
  } catch {
    // kolon henüz yok / çevrimdışı → cihaz kaydı yeterli.
  }
}

function persist(get: () => OnbFirstStore) {
  const { synced, userId } = get();
  AsyncStorage.setItem(ONB_FIRST_KEY, JSON.stringify(synced)).catch(() => {});
  if (userId) void writeRemote(userId, synced);
}

export const useOnbFirst = create<OnbFirstStore>((set, get) => ({
  hydrated: false,
  userId: null,
  synced: EMPTY_SYNCED,
  celebrate: null,

  hydrate: async (userId) => {
    if (get().hydrated && get().userId === userId) return;
    let local = EMPTY_SYNCED;
    try {
      const raw = await AsyncStorage.getItem(ONB_FIRST_KEY);
      if (raw) local = parseSynced(JSON.parse(raw));
    } catch {
      // bozuk kayıt → boş
    }
    const merged0 = mergeSynced(local, get().synced);
    set({ hydrated: true, userId, synced: merged0 });
    if (!userId) return;
    const remote = await readRemote(userId);
    if (!remote) return;
    const merged = mergeSynced(get().synced, remote);
    if (!sameSynced(merged, get().synced)) set({ synced: merged });
    // Cihazda ileri durum varsa profile de yaz (cihazlar arası).
    if (!sameSynced(merged, remote)) persist(get);
    else AsyncStorage.setItem(ONB_FIRST_KEY, JSON.stringify(merged)).catch(() => {});
  },

  setCard: (s) => {
    set({ synced: mergeSynced(get().synced, { ...get().synced, profileCard: s }) });
    persist(get);
  },
  startOrient: () => {
    const cur = get().synced;
    if (cur.orient.started) return;
    set({ synced: { ...cur, orient: { ...cur.orient, started: true } } });
    persist(get);
  },
  seen: (step) => {
    const cur = get().synced;
    set({ synced: { ...cur, orient: markSeen(cur.orient, step) } });
    persist(get);
  },
  skip: () => {
    const cur = get().synced;
    set({ synced: { ...cur, orient: skipAll(cur.orient) } });
    persist(get);
  },
  queueCelebrate: (kcal) => set({ celebrate: { kcal } }),
  clearCelebrate: () => set({ celebrate: null }),
  _reset: (s) => set({ hydrated: true, userId: null, synced: s ?? EMPTY_SYNCED, celebrate: null }),
}));

/** Açılış imzası görüldü mü (yalnız cihaz). Okuma hatası → görülmüş say (imza zorla oynamasın). */
export async function readOpenSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(OPEN_SEEN_KEY)) === 'true';
  } catch {
    return true;
  }
}

export function markOpenSeen(): void {
  AsyncStorage.setItem(OPEN_SEEN_KEY, 'true').catch(() => {});
}
