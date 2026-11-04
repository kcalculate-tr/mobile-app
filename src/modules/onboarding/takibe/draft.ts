// "Takibe başla" taslak durumu (adımlar arası). Zustand; akış bitince reset.
import { create } from 'zustand';
import type { ActivityLevel } from '../../../lib/nutrition';
import type { Pace, TbDraftValues, TbGender, TbGoal } from './calc';

interface TbDraftState extends TbDraftValues {
  /** Profil › Hedefim'den "Hedefi düzenle" ile mi açıldı. */
  editGoal: boolean;
  setGoal: (goal: TbGoal) => void;
  setPace: (pace: Pace) => void;
  setGender: (gender: TbGender) => void;
  setBirthYear: (year: number | null) => void;
  setHeightCm: (cm: number | null) => void;
  setWeightKg: (kg: number | null) => void;
  setConsent: (consent: boolean) => void;
  setActivity: (activity: ActivityLevel) => void;
  reset: (editGoal?: boolean) => void;
}

const initial: TbDraftValues & { editGoal: boolean } = {
  editGoal: false,
  goal: null,
  pace: 0.5,
  gender: null,
  birthYear: null,
  heightCm: null,
  weightKg: null,
  consent: false,
  activity: null,
};

export const useTbDraft = create<TbDraftState>((set) => ({
  ...initial,
  setGoal: (goal) => set({ goal }),
  setPace: (pace) => set({ pace }),
  setGender: (gender) => set({ gender }),
  setBirthYear: (birthYear) => set({ birthYear }),
  setHeightCm: (heightCm) => set({ heightCm }),
  setWeightKg: (weightKg) => set({ weightKg }),
  setConsent: (consent) => set({ consent }),
  setActivity: (activity) => set({ activity }),
  reset: (editGoal = false) => set({ ...initial, editGoal }),
}));
