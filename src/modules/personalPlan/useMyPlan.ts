// G34-S1 — Kayıtlı kişisel plan + haftalık tartılar (Kişisel planım, Check-in, giriş noktaları).
// Oturum içi önbellek (zustand): giriş noktaları her ekranda yeniden ağ isteği atmaz.
import { useCallback, useEffect } from 'react';
import { create } from 'zustand';
import { useAuth } from '../../core/AuthContext';
import { addDays, isoDay } from './calc';
import { loadPlan, loadWeighIns, readCachedPlan, savePlan, type SaveOutcome } from './api';
import type { PpSaved } from './types';

interface MyPlanState {
  uid: string | null;
  saved: PpSaved | null;
  weighIns: { date: string; weightKg: number }[];
  loaded: boolean;
  loading: boolean;
  load: (uid: string, force?: boolean) => Promise<void>;
  save: (uid: string, p: PpSaved) => Promise<SaveOutcome>;
  setWeighIns: (w: { date: string; weightKg: number }[]) => void;
  clear: () => void;
}

export const useMyPlanStore = create<MyPlanState>((set, get) => ({
  uid: null,
  saved: null,
  weighIns: [],
  loaded: false,
  loading: false,
  load: async (uid, force = false) => {
    const s = get();
    if (s.loading || (s.loaded && s.uid === uid && !force)) return;
    set({ loading: true, uid });
    // Önce cihaz (anında), sonra sunucu.
    const cached = await readCachedPlan(uid);
    if (cached && !get().saved) set({ saved: cached });
    const { saved } = await loadPlan(uid, new Date().getFullYear());
    const since = saved?.startedAt ? addDays(saved.startedAt, -14) : addDays(isoDay(new Date()), -120);
    const weighIns = await loadWeighIns(uid, since);
    set({ saved: saved ?? cached ?? null, weighIns, loaded: true, loading: false });
  },
  save: async (uid, p) => {
    set({ saved: p });
    return savePlan(uid, p, new Date().getFullYear());
  },
  setWeighIns: (weighIns) => set({ weighIns }),
  clear: () => set({ uid: null, saved: null, weighIns: [], loaded: false, loading: false }),
}));

export function useMyPlan() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const st = useMyPlanStore();
  useEffect(() => {
    if (uid) void st.load(uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);
  const reload = useCallback(() => (uid ? st.load(uid, true) : Promise.resolve()), [uid, st]);
  return { uid, saved: st.saved, weighIns: st.weighIns, loaded: st.loaded, reload, save: st.save, setWeighIns: st.setWeighIns };
}

/** Sıradaki haftalık tartı günü (bugün dahil) — hatırlatma günü (0 = Pzt). */
export function nextWeighDay(todayIso: string, weighDay: number): string {
  const d = new Date(`${todayIso}T12:00:00`);
  const wd = (d.getDay() + 6) % 7;
  const delta = (weighDay - wd + 7) % 7;
  return addDays(todayIso, delta);
}

/** Bu hafta tartı yapıldı mı (son 6 gün içinde kayıt)? */
export function weighedThisWeek(weighIns: { date: string }[], todayIso: string): boolean {
  const from = addDays(todayIso, -6);
  return weighIns.some((w) => w.date >= from && w.date <= todayIso);
}
