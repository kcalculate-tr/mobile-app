// G34-S1 — Hatırlatma planı (saf; RN yok → tsx --test). Öğün yuvaları planın öğün düzeninden,
// haftalık tartı seçilen gün + saatte. Zamanlama `reminders.ts` (expo-notifications).
import { mealSlots, type MealSlot, type PpMeals, type PpReminders } from './types';

export interface PlannedReminder {
  id: string;
  kind: 'meal' | 'weigh';
  slot?: MealSlot;
  /** expo weekday: 1 = Pazar … 7 = Cumartesi (yalnız tartı). */
  weekday?: number;
  hour: number;
  minute: number;
}

function hm(t: string | undefined, fallback: string): { hour: number; minute: number } {
  const [h, m] = (t ?? fallback).split(':').map(Number);
  return { hour: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 8, minute: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0 };
}

/** Pazartesi = 0 … Pazar = 6 → expo (1 = Pazar … 7 = Cumartesi). */
export function toExpoWeekday(d: number): number {
  return ((d + 1) % 7) + 1;
}

export function planReminders(meals: PpMeals, r: PpReminders): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (const slot of mealSlots(meals.main, meals.snack)) {
    if (r.meals[slot] === false) continue;
    out.push({ id: `pp-meal-${slot}`, kind: 'meal', slot, ...hm(meals.times[slot], slot === 'breakfast' ? '08:00' : '13:00') });
  }
  if (r.weighIn) out.push({ id: 'pp-weigh', kind: 'weigh', weekday: toExpoWeekday(r.weighDay), ...hm(r.weighTime, '08:00') });
  return out;
}

