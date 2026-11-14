// G54-S1 md.2 — Kişisel plan TEK okuyucu/dönüştürücü (saf; RN/ağ importu yok → node:test).
// İki biçim tek yerde çözülür:
//  1) `personal_plan` jsonb (G34 PpSaved v1) — eski kişisel plan akışı VE yeni kayıt (G42 `modules/kayit`, toPpSaved;
//     kayda özgü cevaplar `kayit` anahtarında) aynı şemayı yazar → parseSaved (ek `kayit` anahtarı korunur).
//  2) `personal_plan` yok ama satırda hedef var (`target_calories` / `custom_calories` > 0): B kısa profil
//     (saveTakibeProfile), eski "Takibe başla" / NutritionProfile kullanıcıları → satır kolonlarından PpSaved türetilir
//     (hedef kalori + makrolar SATIRDAN; cevaplar eldeki kolonlardan; hesap adımları mevcut G34 formülüyle).
// Profil kapısı (`rowHasProfile`) ile aynı tanım: satırda profil varsa Kişisel planım DOLU görünür.
import { computeMacros, computePlan, inputComplete, type PpActivity, type PpGender, type PpGoal, type PpPace, type PpResult } from './calc';
import { emptyAnswers, parseSaved, type PpSaved } from './types';

const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) : NaN);
const pos = (v: unknown): number | null => {
  const n = num(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function goalFromRow(g: unknown): PpGoal | null {
  if (g === 'lose_weight' || g === 'lose') return 'lose';
  if (g === 'gain_weight' || g === 'gain') return 'gain';
  if (g === 'maintain') return 'maintain';
  if (g === 'regular' || g === 'balanced') return 'balanced';
  return null;
}

export function activityFromRow(a: unknown): PpActivity | null {
  if (a === 'sedentary' || a === 'light' || a === 'moderate' || a === 'active') return a;
  if (a === 'very_active' || a === 'high') return 'active';
  if (a === 'low') return 'sedentary';
  if (a === 'medium') return 'moderate';
  return null;
}

function genderFromRow(r: Record<string, unknown>): PpGender | null {
  const gc = r.gender_choice;
  if (gc === 'female' || gc === 'male' || gc === 'unspecified') return gc;
  return r.gender === 'male' ? 'male' : r.gender === 'female' ? 'female' : null;
}

/** Satır → plan hangi biçimden geldi. */
export type PlanSource = 'personal_plan' | 'targets' | null;

export function planSourceOf(row: Record<string, unknown> | null | undefined): PlanSource {
  if (!row) return null;
  if (parseSaved(row.personal_plan)) return 'personal_plan';
  return pos(row.target_calories) ?? pos(row.custom_calories) ? 'targets' : null;
}

/** Saf: `user_nutrition_profiles` satırı → gösterilecek kişisel plan (yoksa null = gerçekten plan yok). */
export function planFromRow(row: Record<string, unknown> | null | undefined, currentYear: number, todayIso: string): PpSaved | null {
  if (!row) return null;
  const parsed = parseSaved(row.personal_plan);
  if (parsed) return parsed;
  const kcal = pos(row.target_calories) ?? pos(row.custom_calories);
  if (!kcal) return null;

  const base = emptyAnswers();
  const goal = goalFromRow(row.goal) ?? 'maintain';
  const gender = genderFromRow(row);
  const by = pos(row.birth_year);
  const age = pos(row.age);
  const birthYear = by && by > 1900 ? by : age ? currentYear - age : null;
  const heightCm = pos(row.height);
  const w = pos(row.weight);
  const weightKg = w ? Math.round(w * 10) / 10 : null;
  const activity = activityFromRow(row.activity_level);
  const tw = pos(row.target_weight_kg);
  const p = num(row.pace_kg_week);
  const pace: PpPace = p === 0.25 || p === 0.5 || p === 0.75 ? (p as PpPace) : 0.5;
  const started = typeof row.plan_started_at === 'string' ? row.plan_started_at.slice(0, 10) : typeof row.created_at === 'string' ? row.created_at.slice(0, 10) : todayIso;

  const input = { goal, gender: gender ?? 'unspecified', birthYear: birthYear ?? undefined, heightCm: heightCm ?? undefined, weightKg: weightKg ?? undefined, activity: activity ?? undefined, targetWeightKg: goal === 'lose' || goal === 'gain' ? tw : null, pace };
  let result: PpResult | null = inputComplete(input, currentYear) ? computePlan(input, currentYear, started) : null;
  const macroDefault = computeMacros(kcal, weightKg ?? 70);
  const targets = {
    calories: Math.round(kcal),
    protein: Math.round(pos(row.target_protein) ?? macroDefault.protein),
    carbs: Math.round(pos(row.target_carbs) ?? macroDefault.carbs),
    fat: Math.round(pos(row.target_fat) ?? macroDefault.fat),
  };
  if (!result) {
    result = {
      algoVersion: 0,
      steps: { formula: 'mifflin', sexConst: 0, age: birthYear ? currentYear - birthYear : 0, leanMassKg: null, bmr: 0, factor: 0, tdee: 0, requestedDelta: 0, rawCalories: kcal, floor: 0, floored: false },
      calories: targets.calories,
      macros: { protein: targets.protein, fat: targets.fat, carbs: targets.carbs, proteinKcal: targets.protein * 4, fatKcal: targets.fat * 9 },
      effectivePace: 0,
      requestedPace: 0,
      weeks: null,
      requestedWeeks: null,
      targetDate: null,
      requestedTargetDate: null,
      dateShifted: false,
      unreachable: false,
    };
  }
  // Satırdaki hedef her zaman gösterilen hedeftir; hesaplanan öneriden farklıysa "custom" (Düzenle ile sapma gibi).
  const same = result.calories === targets.calories && result.macros.protein === targets.protein && result.macros.carbs === targets.carbs && result.macros.fat === targets.fat;
  const { consentHealth: _h, consentAllergy: _a, ...rest } = { ...base, goal, gender, birthYear, heightCm, weightKg, activity, targetWeightKg: tw, pace };
  void _h;
  void _a;
  return {
    v: 1,
    answers: rest,
    result,
    custom: same ? null : targets,
    startedAt: started,
    startWeightKg: weightKg ?? 0,
    targetDate: typeof row.plan_target_date === 'string' ? row.plan_target_date : result.targetDate,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '',
    source: 'targets',
  };
}
