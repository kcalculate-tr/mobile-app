// "Takibe başla" saf eşleme + hesaplama (G12-S1 · FinTb*). RN/zustand İÇERMEZ,
// böylece `npm run test:unit` (tsx --test, Node) doğrudan koşar. Günlük hedef
// MEVCUT beslenme profili servisiyle (`lib/nutrition`) hesaplanır — yeni formül
// YOK (yalnız panel niyetlerini servisin tiplerine eşler).

import {
  type ActivityLevel,
  type Gender,
  type Goal,
  type MacroTargets,
  type NutritionProfileInput,
  calculateBMR,
  calculateMacroTargets,
  calculateTDEE,
} from '../../../lib/nutrition';

/** Panel hedefleri (FinTbGoal). "Daha düzenli beslen" = koru (maintain). */
export type TbGoal = 'lose' | 'maintain' | 'gain' | 'regular';
/** Cinsiyet "yalnız hesaplama için" — belirtmeyen hesapta female formülüyle sürer. */
export type TbGender = 'female' | 'male' | 'unspecified';

/**
 * G33-S1 (Tur 26o kararı, 12 Kas): hız sınırı her yerde 0,75 kg/hafta — 1 kg seçeneği kalktı.
 * 0,75 yalnız vücut ağırlığının %1'ini aşmıyorsa seçilebilir (bkz. `allowedPaces`).
 */
export const PACE_OPTIONS = [0.25, 0.5, 0.75] as const;
export type Pace = (typeof PACE_OPTIONS)[number];
/** Haftalık tempo üst sınırı (kg). */
export const MAX_PACE: Pace = 0.75;
/** Haftalık tempo, vücut ağırlığının bu oranını aşamaz (%1). */
export const MAX_PACE_BODY_RATIO = 0.01;
/** BMI bu değerin altındaysa "Kilo ver" kapalı. */
export const MIN_BMI_FOR_LOSE = 18.5;

/**
 * Seçilebilir tempolar. Kilo bilinmiyorsa (akışta tempo kilodan önce sorulur) hepsi açık;
 * kilo girilince `clampPace` aşan seçimi indirir. Kilo × %1'i aşan tempo seçilemez.
 */
export function allowedPaces(weightKg: number | null | undefined): Pace[] {
  if (!weightKg || weightKg <= 0) return [...PACE_OPTIONS];
  const cap = weightKg * MAX_PACE_BODY_RATIO;
  const out = PACE_OPTIONS.filter((p) => p <= cap + 1e-9);
  return out.length ? out : [PACE_OPTIONS[0]];
}

/** Seçili tempoyu kiloya göre izinli en yüksek değere indirir (eski 1 kg kayıtları dahil). */
export function clampPace(pace: number, weightKg: number | null | undefined): Pace {
  const ok = allowedPaces(weightKg);
  const fit = ok.filter((p) => p <= pace + 1e-9);
  return fit.length ? fit[fit.length - 1] : ok[0];
}

export function bmiOf(heightCm: number | null | undefined, weightKg: number | null | undefined): number | null {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
  return weightKg / Math.pow(heightCm / 100, 2);
}

/** "Kilo ver" seçilebilir mi? BMI < 18,5 ise hayır (boy/kilo bilinmiyorsa açık). */
export function canChooseLose(heightCm: number | null | undefined, weightKg: number | null | undefined): boolean {
  const b = bmiOf(heightCm, weightKg);
  return b == null || b >= MIN_BMI_FOR_LOSE;
}

/** Kalori tabanı: kadın 1200, erkek ve belirtmeyen 1500 (Tur 26o). */
export function calorieFloorFor(gender: TbGender): number {
  return gender === 'female' ? 1200 : 1500;
}

export interface TbDraftValues {
  goal: TbGoal | null;
  pace: Pace;
  gender: TbGender | null;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  consent: boolean;
  activity: ActivityLevel | null;
}

/** Tempo yalnızca Kilo ver / Kas yap için sorulur (FinTbPace). */
export function goalNeedsPace(goal: TbGoal | null): boolean {
  return goal === 'lose' || goal === 'gain';
}

export function toServiceGoal(goal: TbGoal): Goal {
  if (goal === 'lose') return 'lose_weight';
  if (goal === 'gain') return 'gain_weight';
  return 'maintain'; // maintain + regular
}

export function toServiceGender(gender: TbGender): Gender {
  // "Belirtmek istemiyorum" → hesaplama için female formülü (daha korumacı taban).
  return gender === 'male' ? 'male' : 'female';
}

export function ageFromBirthYear(birthYear: number, currentYear: number): number {
  return currentYear - birthYear;
}

export function isUnderage(birthYear: number | null, currentYear: number): boolean {
  if (!birthYear) return false;
  return ageFromBirthYear(birthYear, currentYear) < 18;
}

/**
 * Taslaktan servis girdisi üret. Zorunlu alanlardan biri eksik/geçersizse null.
 * `currentYear` dışarıdan verilir (saf fonksiyon; Date'e bağlı değil).
 */
export function buildProfileInput(
  d: TbDraftValues,
  currentYear: number,
): NutritionProfileInput | null {
  if (!d.goal || !d.gender || !d.birthYear || !d.heightCm || !d.weightKg || !d.activity) {
    return null;
  }
  const age = ageFromBirthYear(d.birthYear, currentYear);
  if (age <= 0 || age > 120 || d.heightCm <= 0 || d.weightKg <= 0) return null;
  // G33-S1: BMI < 18,5'te "Kilo ver" kapalı → hesap "koru" ile yapılır.
  const goal = d.goal === 'lose' && !canChooseLose(d.heightCm, d.weightKg) ? 'maintain' : d.goal;
  return {
    age,
    gender: toServiceGender(d.gender),
    heightCm: d.heightCm,
    weightKg: d.weightKg,
    activity: d.activity,
    goal: toServiceGoal(goal),
  };
}

export interface TbResult {
  input: NutritionProfileInput;
  bmr: number;
  tdee: number;
  macros: MacroTargets;
}

export function computeResult(d: TbDraftValues, currentYear: number): TbResult | null {
  const input = buildProfileInput(d, currentYear);
  if (!input) return null;
  const macros = calculateMacroTargets(input);
  // G33-S1: "Belirtmek istemiyorum" hesapta female formülüyle sürer ama taban 1500 (erkekle aynı).
  // Servis female → 1200 uyguladığından eksik kısım karbonhidrata eklenir.
  const floor = d.gender ? calorieFloorFor(d.gender) : 1200;
  if (macros.calories < floor) {
    const add = floor - macros.calories;
    macros.calories = floor;
    macros.carbs = macros.carbs + Math.round(add / 4);
  }
  return {
    input,
    bmr: Math.round(calculateBMR(input)),
    tdee: Math.round(calculateTDEE(input)),
    macros,
  };
}

/**
 * Seçilen tempoda (kg/hafta) ilk 1 kg kilometre taşına kalan GÜN sayısı.
 * Hedef kilosu girişi panellerde yok → kesin hedef tarihi S4/İLTER'E bağlar;
 * burada tempo hissini vermek için ilk-kilo kilometre taşı gösterilir.
 */
export function daysToFirstKg(pace: Pace): number {
  return Math.round((1 / pace) * 7);
}
