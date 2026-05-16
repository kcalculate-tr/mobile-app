import { create } from 'zustand';
import type { ActivityLevel, Gender, Goal } from '../lib/nutrition';

interface NutritionDraft {
  gender?: Gender;
  age?: number;
  height?: number;
  weight?: number;
  goal?: Goal;
  activity?: ActivityLevel;

  set: (data: Partial<Omit<NutritionDraft, 'set' | 'reset'>>) => void;
  reset: () => void;
}

export const useNutritionDraft = create<NutritionDraft>((set) => ({
  set: (data) => set(data),
  reset: () => set({ gender: undefined, age: undefined, height: undefined, weight: undefined, goal: undefined, activity: undefined }),
}));
