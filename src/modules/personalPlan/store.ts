// G34-S1 — Kişisel plan akışı taslak durumu (zustand). Her cevap adımında kaydedilir
// (yerel AsyncStorage + sunucu `personal_plan_progress`; tablo yoksa yalnız yerel).
// "Kaldığın yerden": çıkıp dönen kullanıcı, dört girişin hepsinde son cevapladığı adımda açılır.
import { create } from 'zustand';
import type { PpResult } from './calc';
import { resumable, type FlowStep } from './flow';
import { emptyAnswers, type PpAnswers } from './types';
import { clearProgress, writeProgress } from './api';

export type PpOrigin = 'profile' | 'home' | 'coach' | 'purchase' | 'mine' | 'plan_form' | 'dev';

interface PpState {
  userId: string | null;
  origin: PpOrigin;
  step: FlowStep;
  /** İleri (1) / geri (−1) — içerik geçiş yönü. */
  dir: 1 | -1;
  known: boolean;
  answers: PpAnswers;
  result: PpResult | null;
  /** Sonuç ekranında "Düzenle" ile sapılmış hedefler (null = öneri). */
  custom: { calories: number; protein: number; fat: number; carbs: number } | null;
  /** Bildiklerimiz'den "Düzenle" ile açılan adım: kaydedince Bildiklerimiz'e döner. */
  editingFromKnown: boolean;
  begin: (i: { userId: string | null; origin: PpOrigin; known: boolean; answers?: Partial<PpAnswers>; step?: FlowStep }) => void;
  set: (patch: Partial<PpAnswers>) => void;
  go: (step: FlowStep, dir?: 1 | -1) => void;
  setResult: (r: PpResult | null) => void;
  setCustom: (c: PpState['custom']) => void;
  setEditingFromKnown: (v: boolean) => void;
  reset: () => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist(s: Pick<PpState, 'userId' | 'step' | 'answers' | 'known'>) {
  if (!s.userId || !resumable(s.step)) return;
  if (saveTimer) clearTimeout(saveTimer);
  const rec = { step: s.step, answers: s.answers, known: s.known, at: new Date().toISOString() };
  const uid = s.userId;
  saveTimer = setTimeout(() => {
    void writeProgress(uid, rec);
  }, 400);
}

export const usePpFlow = create<PpState>((set, get) => ({
  userId: null,
  origin: 'profile',
  step: 'intro',
  dir: 1,
  known: false,
  answers: emptyAnswers(),
  result: null,
  custom: null,
  editingFromKnown: false,
  begin: ({ userId, origin, known, answers, step }) =>
    set({
      userId,
      origin,
      known,
      answers: { ...emptyAnswers(), ...(answers ?? {}) },
      step: step ?? 'intro',
      dir: 1,
      result: null,
      custom: null,
      editingFromKnown: false,
    }),
  set: (patch) => {
    set({ answers: { ...get().answers, ...patch } });
    persist(get());
  },
  go: (step, dir = 1) => {
    set({ step, dir });
    persist(get());
  },
  setResult: (result) => set({ result }),
  setCustom: (custom) => set({ custom }),
  setEditingFromKnown: (editingFromKnown) => set({ editingFromKnown }),
  reset: () => {
    const uid = get().userId;
    if (saveTimer) clearTimeout(saveTimer);
    if (uid) void clearProgress(uid);
    set({ step: 'intro', dir: 1, answers: emptyAnswers(), result: null, custom: null, editingFromKnown: false });
  },
}));

/** Testler / çıkış: bekleyen kaydı hemen yaz. */
export function flushProgressNow(): void {
  const s = usePpFlow.getState();
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (s.userId && resumable(s.step)) void writeProgress(s.userId, { step: s.step, answers: s.answers, known: s.known, at: new Date().toISOString() });
}
