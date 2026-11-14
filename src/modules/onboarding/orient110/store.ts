// G54-S1 md.3 — 1.1.0 oryantasyonu durumu: hesap/cihaz işareti, evre, ipucu hedefleri.
// İşaret: cihaz yedeği `@kcal_orient_v110:<uid>` (hesap bazında anahtar) + `profiles.onboarding_state.orient_v110_seen_at`
// (mevcut G18 senkron yapısı; alan oku-birleştir-yaz ile eklenir, diğer alanlar ezilmez). Kolon yok / çevrimdışı →
// yalnız cihaz; hiçbir hata kullanıcıya yansımaz.
import type { RefObject } from 'react';
import type { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { getSupabaseClient } from '../../../core/supabase';
import { track } from '../../../lib/analytics';
import { ONB_KEY } from '../../kayit/storage';
import { ORIENT110_META_KEY, accountOrientSeen, advance, orientDeviceKey, startPhase, stepName, type Orient110Phase, type Orient110Tip } from './logic';

export interface Orient110State {
  uid: string | null;
  decided: boolean;
  seen: boolean;
  /** Tanıtım gösterilecek mi (bu cihazda onboarding görülmedi). */
  intro: boolean;
  phase: Orient110Phase;
  /** Profil › Ayarlar "Uygulama turunu tekrar izle" — yalnız ipuçları, işarete bakmaz. */
  replay: boolean;
  targets: Partial<Record<Orient110Tip, RefObject<View | null>>>;
  /** Ana sayfa hedefinin türü (profilsiz "Planını oluştur" kartı / profilli halka). */
  homeVariant: 'card' | 'ring';
  hydrate: (uid: string | null) => Promise<void>;
  start: () => void;
  next: () => void;
  skip: () => void;
  replayTips: () => void;
  register: (id: Orient110Tip, ref: RefObject<View | null>) => void;
  unregister: (id: Orient110Tip, ref: RefObject<View | null>) => void;
  /** YALNIZ test/vitrin. */
  _set: (p: Partial<Orient110State>) => void;
}

async function readRemoteState(uid: string): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await getSupabaseClient().from('profiles').select('onboarding_state').eq('id', uid).maybeSingle();
    if (error || !data) return null;
    const s = (data as { onboarding_state?: unknown }).onboarding_state;
    return s && typeof s === 'object' ? (s as Record<string, unknown>) : {};
  } catch {
    return null;
  }
}

/** Hesaba yaz: mevcut onboarding_state okunur, yalnız işaret eklenir (diğer alanlar korunur). */
export async function writeAccountSeen(uid: string, at: string): Promise<boolean> {
  try {
    const cur = await readRemoteState(uid);
    if (cur == null) return false;
    if (accountOrientSeen(cur)) return true;
    const { error } = await getSupabaseClient().from('profiles').update({ onboarding_state: { ...cur, [ORIENT110_META_KEY]: at } }).eq('id', uid);
    return !error;
  } catch {
    return false;
  }
}

async function markSeen(uid: string): Promise<void> {
  const at = new Date().toISOString();
  try {
    await AsyncStorage.setItem(orientDeviceKey(uid), at);
  } catch {
    /* yut */
  }
  void writeAccountSeen(uid, at);
}

function emitView(p: Orient110Phase) {
  const step = stepName(p);
  if (step) track('orient_v110_view', { step });
}

function availableOf(t: Orient110State['targets']): Set<Orient110Tip> {
  return new Set(Object.keys(t) as Orient110Tip[]);
}

export const useOrient110 = create<Orient110State>((set, get) => ({
  uid: null,
  decided: false,
  seen: false,
  intro: false,
  phase: { kind: 'idle' },
  replay: false,
  targets: {},
  homeVariant: 'card',

  hydrate: async (uid) => {
    if (get().uid === uid && (get().decided || !uid)) return;
    // Hesap değişti → yeni hesap için yeniden değerlendirilir.
    set({ uid, decided: false, seen: false, intro: false, phase: { kind: 'idle' }, replay: false });
    if (!uid) return;
    let device = false;
    let sawOnb = false;
    try {
      device = (await AsyncStorage.getItem(orientDeviceKey(uid))) != null;
      sawOnb = (await AsyncStorage.getItem(ONB_KEY)) != null;
    } catch {
      /* yut */
    }
    const remote = device ? null : await readRemoteState(uid);
    if (get().uid !== uid) return;
    const seen = device || accountOrientSeen(remote);
    // Başka cihazda görüldüyse cihaz yedeğini de yaz.
    if (seen && !device) AsyncStorage.setItem(orientDeviceKey(uid), new Date().toISOString()).catch(() => {});
    set({ decided: true, seen, intro: !sawOnb });
  },

  start: () => {
    const s = get();
    if (s.phase.kind !== 'idle' || !s.uid) return;
    const p = startPhase(s.intro && !s.replay, availableOf(s.targets));
    // "Bir kez": tur görünür olduğu anda işaretlenir (yarıda kapatılan uygulama turu tekrar zorlamaz).
    if (!s.replay) void markSeen(s.uid);
    set({ phase: p, seen: true });
    if (p.kind === 'done') {
      set({ phase: { kind: 'idle' }, replay: false });
      return;
    }
    emitView(p);
  },

  next: () => {
    const s = get();
    const p = advance(s.phase, availableOf(s.targets));
    if (p.kind === 'done') {
      track('orient_v110_complete', {});
      set({ phase: { kind: 'idle' }, replay: false });
      return;
    }
    set({ phase: p });
    emitView(p);
  },

  skip: () => {
    const s = get();
    const step = stepName(s.phase);
    if (step) track('orient_v110_skip', { step });
    set({ phase: { kind: 'idle' }, replay: false });
  },

  replayTips: () => set({ replay: true, phase: { kind: 'idle' } }),

  register: (id, ref) => set((s) => ({ targets: { ...s.targets, [id]: ref } })),
  unregister: (id, ref) =>
    set((s) => {
      if (s.targets[id] !== ref) return s;
      const next = { ...s.targets };
      delete next[id];
      return { targets: next };
    }),
  _set: (p) => set(p),
}));
