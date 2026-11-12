// coach-chat — kişisel plan bağlamı (G36-S1 md.13, İlter 12 Kas). SAF: import yok; Deno ve
// Node/tsx ikisinde de çalışır (src/modules/coach/__tests__/g36CoachPlan.test.ts).
//
// Sistem istemi kişisel planı (hedef, kalori/makro, tempo, hedef tarihi) YALNIZ Koç AI izni
// açıksa okur. İzin kararı: kullanıcının en son `user_consents` kind 'ai_coach' satırı (geri
// alma her zaman kazanır); sunucu satırı yoksa (istemci yazımı en iyi çaba) istemcinin
// `ai_consent: true` bildirimi — istemci yalnız cihazda geçerli izin varken true gönderir.
// Kaynak: user_nutrition_profiles.personal_plan (jsonb, şema src/modules/personalPlan/types.ts)
// + tipli kolonlar (migration 20261112110100_g34_personal_plan). Kolonlar yoksa bağlam yok.

export interface PersonalPlanCtx {
  goal: 'lose' | 'maintain' | 'gain' | 'balanced';
  startWeightKg: number | null;
  targetWeightKg: number | null;
  /** Etkin tempo (kg/hafta); koru/dengeli → 0. */
  paceKgWeek: number | null;
  /** Günlük hedefler (Düzenle ile sapıldıysa kullanıcının değerleri). */
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  /** Hedef tarihi YYYY-MM-DD (hedef yoksa null). */
  targetDate: string | null;
  startedAt: string | null;
}

const GOALS = ['lose', 'maintain', 'gain', 'balanced'] as const;

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const day = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Koç AI izni: son sunucu satırı kazanır; satır yoksa istemci bildirimi. */
export function coachConsentGranted(latest: { granted?: unknown } | null | undefined, clientClaim: unknown): boolean {
  if (latest && typeof latest.granted === 'boolean') return latest.granted;
  return clientClaim === true;
}

/** Profil satırından istem bağlamı (bozuk / eksik jsonb → null). */
export function personalPlanContext(row: Record<string, unknown> | null | undefined): PersonalPlanCtx | null {
  if (!row) return null;
  const pp = obj(row.personal_plan);
  if (pp.v !== 1) return null;
  const answers = obj(pp.answers);
  const result = obj(pp.result);
  const macros = obj(result.macros);
  const custom = pp.custom ? obj(pp.custom) : null;
  const goal = GOALS.find((g) => g === answers.goal);
  const calories = num(custom?.calories) ?? num(result.calories);
  if (!goal || calories == null || calories <= 0) return null;
  const hasTarget = goal === 'lose' || goal === 'gain';
  const round1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
  return {
    goal,
    startWeightKg: round1(num(pp.startWeightKg) ?? num(answers.weightKg)),
    targetWeightKg: hasTarget ? round1(num(row.target_weight_kg) ?? num(answers.targetWeightKg)) : null,
    paceKgWeek: hasTarget ? (num(result.effectivePace) ?? num(row.pace_kg_week)) : 0,
    calories: Math.round(calories),
    protein: num(custom?.protein) ?? num(macros.protein),
    carbs: num(custom?.carbs) ?? num(macros.carbs),
    fat: num(custom?.fat) ?? num(macros.fat),
    targetDate: hasTarget ? (day(pp.targetDate) ?? day(row.plan_target_date) ?? day(result.targetDate)) : null,
    startedAt: day(pp.startedAt) ?? day(row.plan_started_at),
  };
}
