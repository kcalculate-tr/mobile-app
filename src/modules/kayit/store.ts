// G42-S1 — Kayıt akışı oturum durumu (zustand). Cevaplar A yolunda her değişiklikte cihaza yazılır
// (R1 taslağı, 7 gün — storage.ts). Kayıt tamamlanınca taslak silinir.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { emptyKAnswers, type KAnswers, type KPath, type KStart, type KStep, type KUnits } from './model';
import { clearDraft, writeDraft, type DraftPlanSummary, type KDraft, type KvStore } from './storage';
import type { KPlan } from './plan';

export const kv: KvStore = AsyncStorage as unknown as KvStore;

export interface KayitState {
  path: KPath;
  start: KStart | null;
  answers: KAnswers;
  step: KStep;
  plan: KPlan | null;
  /** Planın hesaplandığı cevap imzası (L2'den geri → değişti mi). */
  planSig: string | null;
  /** L1 en az bir kez tamamlandı (geri dönüşte 1,5 sn kısa sürüm). */
  calcDone: boolean;
  /** Sağlık verisi açık rızası (L2 / kısa profil son adım). */
  healthOk: boolean;
  /** Kayıttan sonra plan e-postası gönderildi mi (T1 bandı). */
  emailSent: boolean;
  setPath: (p: KPath) => void;
  setStart: (s: KStart | null) => void;
  patch: (p: Partial<KAnswers>) => void;
  setStep: (s: KStep) => void;
  setPlan: (p: KPlan | null, sig: string | null) => void;
  setCalcDone: (v: boolean) => void;
  setHealthOk: (v: boolean) => void;
  setEmailSent: (v: boolean) => void;
  setUnits: (u: KUnits) => void;
  restore: (d: KDraft) => void;
  reset: (units?: KUnits) => void;
}

function summary(p: KPlan | null): DraftPlanSummary | null {
  return p ? { calories: p.calories, protein: p.protein, carbs: p.carbs, fat: p.fat } : null;
}

export const useKayit = create<KayitState>((set, get) => ({
  path: 'a',
  start: null,
  answers: emptyKAnswers(),
  step: 'goal',
  plan: null,
  planSig: null,
  calcDone: false,
  healthOk: false,
  emailSent: false,
  setPath: (path) => set({ path }),
  setStart: (start) => set({ start }),
  patch: (p) => {
    set({ answers: { ...get().answers, ...p } });
    persist();
  },
  setStep: (step) => {
    set({ step });
    persist();
  },
  setPlan: (plan, planSig) => {
    set({ plan, planSig });
    persist();
  },
  setCalcDone: (calcDone) => set({ calcDone }),
  setHealthOk: (healthOk) => set({ healthOk }),
  setEmailSent: (emailSent) => set({ emailSent }),
  setUnits: (units) => {
    set({ answers: { ...get().answers, units } });
    persist();
  },
  restore: (d) =>
    set({
      path: 'a',
      start: d.start,
      answers: { ...emptyKAnswers(), ...d.answers },
      step: d.step === 'plan' || d.step === 'result' || d.step === 'signup' ? 'struggle' : d.step,
      plan: null,
      planSig: null,
      calcDone: false,
    }),
  reset: (units = 'metric') =>
    set({ path: 'a', start: null, answers: emptyKAnswers(units), step: 'goal', plan: null, planSig: null, calcDone: false, healthOk: false, emailSent: false }),
}));

let timer: ReturnType<typeof setTimeout> | null = null;
/** A yolunda taslağı cihaza yaz (kısa birleştirme; B yolu kısa profil hesaba yazılır, taslak tutulmaz). */
function persist(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const s = useKayit.getState();
    if (s.path !== 'a' || s.answers.goal == null) return;
    void writeDraft(kv, { answers: s.answers, step: s.step, start: s.start, plan: summary(s.plan) });
  }, 250);
}

/** Taslağı hemen yaz (L2'ye ulaşınca / kayıt ekranında; R1 kartı plan özetini bulsun). */
export async function flushDraft(step: KDraft['step']): Promise<void> {
  const s = useKayit.getState();
  if (s.path !== 'a') return;
  await writeDraft(kv, { answers: s.answers, step, start: s.start, plan: summary(s.plan) });
}

export async function dropDraft(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  await clearDraft(kv);
}
