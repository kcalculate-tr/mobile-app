// G34-S1 · Tur 26o — Kişisel plan HESAP + GÜVENLİK kuralları (saf; RN/zustand İÇERMEZ,
// `npm run test:unit` (tsx --test, Node) doğrudan koşar).
//
// İlter kararları (12 Kas, onaylı) — BAĞLAYICI:
// - BMR: Mifflin-St Jeor; vücut yağı oranı girilirse Katch-McArdle.
//   "Belirtmek istemiyorum" → hesapta kadın formülü (mevcut Takibe başla ile aynı, korumacı).
// - Aktivite katsayıları 1,2 / 1,375 / 1,55 / 1,725 (dört düzey).
// - Açık (fazla) = tempo × 7700 / 7 kcal/gün. Günlük kalori 10'a yuvarlanır.
// - Kalori tabanı 1200 (kadın) / 1500 (erkek ve belirtmeyen). Tabanın altına İNMEZ;
//   etkin tempo düşer, hedef tarihi kayar ve kullanıcıya söylenir.
// - Tempo 0,25 / 0,5 / 0,75 kg/hafta; 0,75 yalnız ≤ vücut ağırlığının %1'i ise açık.
//   Kas kazan yalnız 0,25 / 0,5.
// - G36 md.11 (İlter 12 Kas): kas kazan fazlası üst sınırı +300 kcal/gün — 0,25 → +275,
//   0,5 → +300 (kırpılır); etkin tempo ve hedef tarihi kırpılmış fazladan hesaplanır.
// - VKİ < 18,5 → "Kilo ver" sunulmaz. 18 yaş altı → akış kapalı.
// - Protein 1,8 g/kg · yağ kalorinin %27'si · karbonhidrat kalan.
// "Nasıl hesapladık?" ara değerleri BURADAN gelir (gerçek hesap; sahte sayı yok).

// 2 = G36 md.11 (kas kazan fazlası +300 kcal üst sınırı).
export const PLAN_ALGO_VERSION = 2;

export type PpGoal = 'lose' | 'maintain' | 'gain' | 'balanced';
export type PpGender = 'female' | 'male' | 'unspecified';
export type PpActivity = 'sedentary' | 'light' | 'moderate' | 'active';
export type PpPace = 0.25 | 0.5 | 0.75;

export const PP_GOALS: readonly PpGoal[] = ['lose', 'maintain', 'gain', 'balanced'];
export const PP_ACTIVITIES: readonly PpActivity[] = ['sedentary', 'light', 'moderate', 'active'];
export const ACTIVITY_FACTOR: Record<PpActivity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};
export const LOSE_PACES: readonly PpPace[] = [0.25, 0.5, 0.75];
export const GAIN_PACES: readonly PpPace[] = [0.25, 0.5];

export const KCAL_PER_KG = 7700;
export const PROTEIN_G_PER_KG = 1.8;
export const FAT_RATIO = 0.27;
export const BMI_UNDERWEIGHT = 18.5;
export const MIN_AGE = 18;
export const MAX_WEEKLY_RATIO = 0.01; // haftalık hız ≤ vücut ağırlığının %1'i
/** G36 md.11: kas kazan günlük fazlası en çok +300 kcal. */
export const GAIN_SURPLUS_MAX = 300;

/** Kalori tabanı: kadın 1200; erkek ve belirtmeyen 1500. */
export function calorieFloor(gender: PpGender): number {
  return gender === 'female' ? 1200 : 1500;
}

export function round10(n: number): number {
  return Math.round(n / 10) * 10;
}

/** Bir ondalığa yuvarla (kg / tempo gösterimi). */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function ageFrom(birthYear: number, currentYear: number): number {
  return currentYear - birthYear;
}

/** 18 yaş altı → akış kapalı. Doğum yılı yoksa false (henüz bilinmiyor). */
export function isMinor(birthYear: number | null | undefined, currentYear: number): boolean {
  if (!birthYear) return false;
  return ageFrom(birthYear, currentYear) < MIN_AGE;
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  if (!(m > 0) || !(weightKg > 0)) return 0;
  return weightKg / (m * m);
}

/** VKİ < 18,5 → "Kilo ver" sunulmaz (18,5'in kendisi sunulur). */
export function canOfferLose(weightKg: number | null, heightCm: number | null): boolean {
  if (!weightKg || !heightCm) return true; // henüz bilinmiyor: Hedef ekranı temel bilgilerden önce
  return bmi(weightKg, heightCm) >= BMI_UNDERWEIGHT;
}

/** Hedef seçilebilir mi? (Kilo ver yalnız VKİ ≥ 18,5.) */
export function goalAllowed(goal: PpGoal, weightKg: number | null, heightCm: number | null): boolean {
  return goal === 'lose' ? canOfferLose(weightKg, heightCm) : true;
}

/** Hedef kilo ve hız adımı yalnız Kilo ver / Kas kazan için sorulur. */
export function goalNeedsTarget(goal: PpGoal | null | undefined): boolean {
  return goal === 'lose' || goal === 'gain';
}

/** Haftalık en yüksek güvenli hız (kg) = vücut ağırlığının %1'i. */
export function maxWeeklyKg(weightKg: number): number {
  return round2(weightKg * MAX_WEEKLY_RATIO);
}

/** Tempo seçeneği açık mı? 0,75 yalnız ≤ %1 ise; Kas kazan'da 0,75 hiç yok. */
export function paceAllowed(goal: PpGoal, pace: PpPace, weightKg: number): boolean {
  if (goal === 'gain') return GAIN_PACES.includes(pace) && pace <= weightKg * MAX_WEEKLY_RATIO + 1e-9;
  if (goal !== 'lose') return false;
  if (pace < 0.75) return true;
  return pace <= weightKg * MAX_WEEKLY_RATIO + 1e-9;
}

export function paceOptions(goal: PpGoal): readonly PpPace[] {
  return goal === 'gain' ? GAIN_PACES : goal === 'lose' ? LOSE_PACES : [];
}

/** Seçili tempo artık kapalıysa (kilo değişti) açık olan en yakın alta iner. */
export function clampPace(goal: PpGoal, pace: PpPace, weightKg: number): PpPace {
  const opts = paceOptions(goal);
  if (!opts.length) return 0.5;
  if (paceAllowed(goal, pace, weightKg)) return pace;
  const open = opts.filter((p) => p <= pace && paceAllowed(goal, p, weightKg));
  return open.length ? open[open.length - 1] : opts[0];
}

/** Sağlıklı hedef kilo alt sınırı: VKİ 18,5 (0,5 kg adımına yukarı yuvarlanır). */
export function minHealthyWeight(heightCm: number): number {
  const m = heightCm / 100;
  return Math.ceil(BMI_UNDERWEIGHT * m * m * 2) / 2;
}

/** Hedef kilo tekerleği aralığı (0,5 kg adım). */
export function targetRange(goal: PpGoal, weightKg: number, heightCm: number): { min: number; max: number } {
  const w = Math.round(weightKg * 2) / 2;
  if (goal === 'gain') return { min: w + 0.5, max: w + 30 };
  const min = Math.min(minHealthyWeight(heightCm), w - 0.5);
  return { min: Math.max(30, min), max: w - 0.5 };
}

/** Hedef kilo geçerli mi (yön + sağlıklı alt sınır)? */
export function targetValid(goal: PpGoal, weightKg: number, heightCm: number, target: number | null): boolean {
  if (!goalNeedsTarget(goal)) return true;
  if (target == null || !Number.isFinite(target)) return false;
  if (goal === 'lose') return target < weightKg && target >= minHealthyWeight(heightCm);
  return target > weightKg && target <= weightKg + 30;
}

/** Varsayılan hedef kilo önerisi: kilo ver −%10 (sağlıklı sınırda kesilir), kas kazan +3 kg. */
export function suggestTarget(goal: PpGoal, weightKg: number, heightCm: number): number | null {
  if (goal === 'lose') {
    const t = Math.round(weightKg * 0.9 * 2) / 2;
    return Math.max(t, Math.min(minHealthyWeight(heightCm), weightKg - 0.5));
  }
  if (goal === 'gain') return Math.round((weightKg + 3) * 2) / 2;
  return null;
}

// ─── Tarih yardımcıları (saat dilimi güvenli: yerel YYYY-MM-DD) ────────────────
export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function addDays(iso: string, days: number): string {
  const d = parseDay(iso);
  d.setDate(d.getDate() + days);
  return isoDay(d);
}

export function weeksBetween(fromIso: string, toIso: string): number {
  const ms = parseDay(toIso).getTime() - parseDay(fromIso).getTime();
  return ms / (7 * 24 * 3600 * 1000);
}

// ─── Girdi + sonuç ────────────────────────────────────────────────────────────
export interface PpCalcInput {
  goal: PpGoal;
  gender: PpGender;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activity: PpActivity;
  /** Kilo ver / Kas kazan için; diğerlerinde yok sayılır. */
  targetWeightKg?: number | null;
  pace?: PpPace | null;
  /** Vücut yağ oranı (%) — girilirse Katch-McArdle. 3–60 dışı yok sayılır. */
  bodyFatPct?: number | null;
}

export type BmrFormula = 'mifflin' | 'katch';

export interface PpCalcSteps {
  formula: BmrFormula;
  /** Mifflin: 10·kg + 6,25·cm − 5·yaş + s (s = +5 erkek, −161 kadın/belirtmeyen). */
  sexConst: number;
  age: number;
  /** Katch: yağsız kütle (kg). */
  leanMassKg: number | null;
  bmr: number;
  factor: number;
  tdee: number;
  /** İstenen tempoya göre günlük açık (+) / fazla (−); koru/dengeli → 0. */
  requestedDelta: number;
  /** Ham günlük kalori (tdee − açık, yuvarlanmadan). */
  rawCalories: number;
  floor: number;
  /** Taban devreye girdi mi (Kilo ver). */
  floored: boolean;
  /** G36 md.11: kas kazan fazlası kırpıldıysa kırpılmadan önceki fazla (kcal, ör. 550); yoksa yok. */
  surplusUncapped?: number | null;
}

export interface PpMacros {
  protein: number;
  fat: number;
  carbs: number;
  proteinKcal: number;
  fatKcal: number;
}

export interface PpResult {
  algoVersion: number;
  steps: PpCalcSteps;
  calories: number;
  macros: PpMacros;
  /** Etkin tempo (kg/hafta, 2 ondalık) — taban yüzünden istenenden düşük olabilir. */
  effectivePace: number;
  requestedPace: number;
  /** Hedefe kalan hafta (yukarı yuvarlanır); hedef yoksa / ulaşılamazsa null. */
  weeks: number | null;
  /** İstenen tempoyla olacak hafta (taban yoksa weeks ile aynı). */
  requestedWeeks: number | null;
  /** Hedef tarihi (YYYY-MM-DD) — başlangıç gününden; yoksa null. */
  targetDate: string | null;
  requestedTargetDate: string | null;
  /** Taban yüzünden hedef tarihi kaydı mı? */
  dateShifted: boolean;
  /** Bu kalori ve tempoyla hedefe hiç ulaşılamaz (TDEE ≤ taban). */
  unreachable: boolean;
}

export function validBodyFat(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 3 && v <= 60;
}

export function computeBmr(input: Pick<PpCalcInput, 'gender' | 'birthYear' | 'heightCm' | 'weightKg' | 'bodyFatPct'>, currentYear: number) {
  const age = ageFrom(input.birthYear, currentYear);
  const sexConst = input.gender === 'male' ? 5 : -161;
  if (validBodyFat(input.bodyFatPct)) {
    const lean = input.weightKg * (1 - input.bodyFatPct / 100);
    return { formula: 'katch' as const, bmr: Math.round(370 + 21.6 * lean), age, sexConst, leanMassKg: round1(lean) };
  }
  const bmr = Math.round(10 * input.weightKg + 6.25 * input.heightCm - 5 * age + sexConst);
  return { formula: 'mifflin' as const, bmr, age, sexConst, leanMassKg: null };
}

/** Makrolar: protein 1,8 g/kg; yağ kalorinin %27'si; karbonhidrat kalan (≥ 0). */
export function computeMacros(calories: number, weightKg: number): PpMacros {
  const protein = Math.round(weightKg * PROTEIN_G_PER_KG);
  const proteinKcal = protein * 4;
  const fatKcal = Math.round(calories * FAT_RATIO);
  const fat = Math.round(fatKcal / 9);
  const carbs = Math.max(0, Math.round((calories - proteinKcal - fatKcal) / 4));
  return { protein, fat, carbs, proteinKcal, fatKcal };
}

export function deltaForPace(pace: number): number {
  return Math.round((pace * KCAL_PER_KG) / 7);
}

export function paceForDelta(delta: number): number {
  return round2((delta * 7) / KCAL_PER_KG);
}

/** Kas kazan günlük fazlası: tempo × 7700 / 7, en çok +300 kcal (0,25 → 275, 0,5 → 300). */
export function gainSurplus(pace: number): number {
  return Math.min(deltaForPace(pace), GAIN_SURPLUS_MAX);
}

/** Girdi hesaplanabilir mi? (Geçersiz → null; ekran Hata hâlini gösterir.) */
export function inputComplete(i: Partial<PpCalcInput>, currentYear: number): i is PpCalcInput {
  if (!i.goal || !i.gender || !i.birthYear || !i.heightCm || !i.weightKg || !i.activity) return false;
  const age = ageFrom(i.birthYear, currentYear);
  if (age < MIN_AGE || age > 120) return false;
  if (i.heightCm < 100 || i.heightCm > 250 || i.weightKg < 30 || i.weightKg > 300) return false;
  return true;
}

export function computePlan(input: PpCalcInput, currentYear: number, startIso: string): PpResult | null {
  if (!inputComplete(input, currentYear)) return null;
  const { goal, weightKg } = input;
  const b = computeBmr(input, currentYear);
  const factor = ACTIVITY_FACTOR[input.activity];
  const tdee = Math.round(b.bmr * factor);
  const floor = calorieFloor(input.gender);

  const hasTarget = goalNeedsTarget(goal) && targetValid(goal, weightKg, input.heightCm, input.targetWeightKg ?? null);
  const requestedPace = hasTarget ? clampPace(goal, (input.pace ?? 0.5) as PpPace, weightKg) : 0;
  let requestedDelta = 0;
  let surplusUncapped: number | null = null;
  if (goal === 'lose') requestedDelta = deltaForPace(requestedPace);
  else if (goal === 'gain') {
    const full = deltaForPace(requestedPace);
    requestedDelta = -gainSurplus(requestedPace);
    if (full > GAIN_SURPLUS_MAX) surplusUncapped = full;
  }

  const rawCalories = tdee - requestedDelta;
  let calories = round10(rawCalories);
  // Yuvarlama üst sınırı aşmasın (tdee + 300'ün altındaki en yakın 10'a).
  if (goal === 'gain') calories = Math.min(calories, Math.floor((tdee + GAIN_SURPLUS_MAX) / 10) * 10);
  let floored = false;
  if (calories < floor) {
    calories = floor;
    floored = goal === 'lose';
  }

  // Etkin tempo: kilo ver'de (tdee − kalori); kas kazan'da (kalori − tdee).
  let effectivePace = 0;
  if (goal === 'lose') effectivePace = floored ? Math.max(0, paceForDelta(tdee - calories)) : requestedPace;
  else if (goal === 'gain') effectivePace = surplusUncapped != null ? paceForDelta(-requestedDelta) : requestedPace;

  let weeks: number | null = null;
  let requestedWeeks: number | null = null;
  let unreachable = false;
  if (hasTarget && input.targetWeightKg != null) {
    const diff = Math.abs(weightKg - input.targetWeightKg);
    requestedWeeks = requestedPace > 0 ? Math.ceil(diff / requestedPace - 1e-9) : null;
    if (effectivePace > 0) weeks = Math.ceil(diff / effectivePace - 1e-9);
    else unreachable = true;
  }
  const targetDate = weeks != null ? addDays(startIso, weeks * 7) : null;
  const requestedTargetDate = requestedWeeks != null ? addDays(startIso, requestedWeeks * 7) : null;

  return {
    algoVersion: PLAN_ALGO_VERSION,
    steps: {
      formula: b.formula,
      sexConst: b.sexConst,
      age: b.age,
      leanMassKg: b.leanMassKg,
      bmr: b.bmr,
      factor,
      tdee,
      requestedDelta,
      rawCalories,
      floor,
      floored,
      ...(surplusUncapped != null ? { surplusUncapped } : {}),
    },
    calories,
    macros: computeMacros(calories, weightKg),
    effectivePace: round2(effectivePace),
    requestedPace,
    weeks,
    requestedWeeks,
    targetDate,
    requestedTargetDate,
    dateShifted: floored && targetDate !== requestedTargetDate,
    unreachable,
  };
}

// ─── Düzenle (öneri dışına çıkınca güvenlik uyarısı) ──────────────────────────
export interface PpCustomTargets {
  calories: number;
  protein: number;
  fat: number;
}

export type EditWarning = 'below_floor' | 'far_from_suggestion' | 'protein_low' | null;

/** Düzenlenmiş hedefleri sınırla: kalori tabanın altına İNMEZ. Karbonhidrat kalandan. */
export function applyCustom(t: PpCustomTargets, gender: PpGender): { calories: number; protein: number; fat: number; carbs: number } {
  const calories = Math.max(calorieFloor(gender), round10(t.calories));
  const protein = Math.max(0, Math.round(t.protein));
  const fat = Math.max(0, Math.round(t.fat));
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, fat, carbs };
}

/** Önerinin dışına çıkınca TEK satır güvenlik uyarısı (önce en önemlisi). */
export function editWarning(t: PpCustomTargets, suggested: PpResult, gender: PpGender, weightKg: number): EditWarning {
  if (t.calories < calorieFloor(gender)) return 'below_floor';
  if (Math.abs(t.calories - suggested.calories) > suggested.calories * 0.15) return 'far_from_suggestion';
  if (t.protein < weightKg * 0.8) return 'protein_low';
  return null;
}

// ─── Haftalık check-in ────────────────────────────────────────────────────────
export interface WeighIn {
  date: string; // YYYY-MM-DD
  weightKg: number;
}

export type CheckinKind = 'none' | 'on_track' | 'slow' | 'fast' | 'fluctuation';

export interface CheckinSuggestion {
  kind: CheckinKind;
  /** Bu haftaki değişim (kg, + arttı). Önceki tartı yoksa null. */
  weekDelta: number | null;
  /** Son ≤ 3 haftanın haftalık ortalama hızı (kg/hafta, + kayıp kilo ver'de). */
  avgRate: number | null;
  /** Gözlenen gerçek harcama tahmini (kcal). */
  estTdee: number | null;
  /** Öneri (Uygula) — yalnız slow / fast. Kalori OTOMATİK değişmez. */
  newCalories: number | null;
  newPace: number | null;
  newMacros: PpMacros | null;
  /** Güvenli üst sınır (kg/hafta). */
  safeMax: number;
  /** Hedef tarihi — KENDİLİĞİNDEN güncellenir (mevcut tempoyla, son tartıdan). */
  autoTargetDate: string | null;
  /** Öneri uygulanırsa hedef tarihi. */
  newTargetDate: string | null;
}

export const CHECKIN_MIN_WEEKS = 2; // trend için en az 2 haftalık aralık (3 tartı)
export const CHECKIN_WINDOW_WEEKS = 3;
export const MAX_DECREASE_STEP = 100; // öneri başına en fazla −100 kcal (kademeli)

export function sortWeighIns(list: WeighIn[]): WeighIn[] {
  return [...list].filter((w) => w.weightKg > 0).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Check-in önerisi. `plan`: güncel plan (kalori, tempo, hedef, cinsiyet).
 * Kurallar: tek tartıyla plan değişmez (fluctuation / on_track); en az 3 tartı ve ≥ 2 haftalık
 * aralık varsa ortalama hıza bakılır. Kilo ver: hız > güvenli üst sınır (%1) → fast (kaloriyi artır,
 * tempo plana döner); hız < planlanan × 0,8 → slow (kademeli −100 kcal, tabanın altına inmez).
 */
export function checkinSuggestion(
  weighIns: WeighIn[],
  plan: { goal: PpGoal; calories: number; pace: number; targetWeightKg: number | null; gender: PpGender; heightCm: number },
  todayIso: string,
): CheckinSuggestion {
  const list = sortWeighIns(weighIns);
  const last = list[list.length - 1];
  const prev = list[list.length - 2];
  const safeMax = last ? maxWeeklyKg(last.weightKg) : 0;
  const empty: CheckinSuggestion = {
    kind: 'none',
    weekDelta: null,
    avgRate: null,
    estTdee: null,
    newCalories: null,
    newPace: null,
    newMacros: null,
    safeMax,
    autoTargetDate: null,
    newTargetDate: null,
  };
  if (!last) return empty;

  const dateFor = (pace: number): string | null => {
    if (!goalNeedsTarget(plan.goal) || plan.targetWeightKg == null || !(pace > 0)) return null;
    const diff = plan.goal === 'lose' ? last.weightKg - plan.targetWeightKg : plan.targetWeightKg - last.weightKg;
    if (diff <= 0) return todayIso;
    return addDays(todayIso, Math.ceil(diff / pace - 1e-9) * 7);
  };

  const weekDelta = prev ? round1(last.weightKg - prev.weightKg) : null;
  const autoTargetDate = dateFor(plan.pace);

  // Pencere: son tartıdan geriye en fazla 3 hafta.
  const windowStart = addDays(last.date, -CHECKIN_WINDOW_WEEKS * 7 - 3);
  const win = list.filter((w) => w.date >= windowStart);
  const first = win[0];
  const spanWeeks = first ? weeksBetween(first.date, last.date) : 0;
  const lossSign = plan.goal === 'gain' ? -1 : 1; // + = planın yönünde ilerleme
  const avgRate = win.length >= 3 && spanWeeks >= CHECKIN_MIN_WEEKS - 0.3 ? round2(((first.weightKg - last.weightKg) / spanWeeks) * lossSign) : null;

  const base = { ...empty, weekDelta, autoTargetDate };
  if (avgRate == null) {
    // Trend yok: tek tartıyla plan değişmez.
    if (weekDelta != null && weekDelta * lossSign > 0 && plan.goal !== 'maintain' && plan.goal !== 'balanced') {
      return { ...base, kind: 'fluctuation' };
    }
    return { ...base, kind: prev ? 'on_track' : 'none' };
  }

  // Gerçek harcama tahmini: plan kalorisi ≈ alım; kilo değişiminin enerji karşılığı eklenir.
  const estTdee = Math.round(plan.calories + (((first.weightKg - last.weightKg) / spanWeeks) * KCAL_PER_KG) / 7);
  const floor = calorieFloor(plan.gender);
  const withEst = { ...base, avgRate, estTdee };

  if (plan.goal === 'lose') {
    if (avgRate > safeMax + 1e-9) {
      const target = Math.max(plan.pace, 0.25);
      const newCalories = Math.max(floor, round10(estTdee - deltaForPace(target)));
      if (newCalories <= plan.calories) return { ...withEst, kind: 'on_track' };
      const newPace = Math.max(0, paceForDelta(estTdee - newCalories));
      return { ...withEst, kind: 'fast', newCalories, newPace, newMacros: computeMacros(newCalories, last.weightKg), newTargetDate: dateFor(newPace) };
    }
    if (avgRate < plan.pace * 0.8) {
      const ideal = round10(estTdee - deltaForPace(plan.pace));
      const newCalories = Math.max(floor, Math.max(ideal, plan.calories - MAX_DECREASE_STEP));
      if (newCalories >= plan.calories) {
        // Taban yüzünden düşülemiyor → öneri yok, yalnız tarih kayar.
        return { ...withEst, kind: weekDelta != null && weekDelta > 0 ? 'fluctuation' : 'on_track' };
      }
      const newPace = Math.max(0, paceForDelta(estTdee - newCalories));
      return { ...withEst, kind: 'slow', newCalories, newPace, newMacros: computeMacros(newCalories, last.weightKg), newTargetDate: dateFor(newPace) };
    }
    return { ...withEst, kind: weekDelta != null && weekDelta > 0 ? 'fluctuation' : 'on_track' };
  }

  if (plan.goal === 'gain') {
    // avgRate burada kazanım hızı (+ = kazanıyor).
    if (avgRate > Math.max(plan.pace * 1.5, plan.pace + 0.25)) {
      const newCalories = Math.max(floor, round10(estTdee + gainSurplus(plan.pace)));
      if (newCalories >= plan.calories) return { ...withEst, kind: 'on_track' };
      const newPace = paceForDelta(newCalories - estTdee);
      return { ...withEst, kind: 'fast', newCalories, newPace, newMacros: computeMacros(newCalories, last.weightKg), newTargetDate: dateFor(newPace) };
    }
    if (avgRate < plan.pace * 0.5) {
      // G36 md.11: öneri de +300 kcal fazla sınırını aşmaz.
      const newCalories = Math.min(round10(estTdee + gainSurplus(plan.pace)), Math.floor((estTdee + GAIN_SURPLUS_MAX) / 10) * 10, plan.calories + 150);
      if (newCalories <= plan.calories) return { ...withEst, kind: 'on_track' };
      const newPace = Math.max(0, paceForDelta(newCalories - estTdee));
      return { ...withEst, kind: 'slow', newCalories, newPace, newMacros: computeMacros(newCalories, last.weightKg), newTargetDate: dateFor(newPace) };
    }
    return { ...withEst, kind: 'on_track' };
  }

  // Koru / dengeli: haftada ±0,25 kg'dan fazla kayma → koruma kalorisine öneri.
  if (Math.abs(avgRate) > 0.25) {
    const step = avgRate > 0 ? 150 : -MAX_DECREASE_STEP; // kaybediyorsa artır, kazanıyorsa kademeli azalt
    const newCalories = Math.max(floor, round10(avgRate > 0 ? Math.min(estTdee, plan.calories + step) : Math.max(estTdee, plan.calories + step)));
    if (newCalories === plan.calories) return { ...withEst, kind: 'on_track' };
    return { ...withEst, kind: avgRate > 0 ? 'fast' : 'slow', newCalories, newPace: 0, newMacros: computeMacros(newCalories, last.weightKg) };
  }
  return { ...withEst, kind: 'on_track' };
}

/** Plan başlangıcından bu yana kaçıncı hafta (1'den başlar). */
export function weekIndex(startIso: string, todayIso: string): number {
  return Math.max(1, Math.floor(weeksBetween(startIso, todayIso)) + 1);
}

/**
 * "Düzenle" ile kalori değiştiyse etkin tempo / hafta / hedef tarihi (kilo ver: tdee − kalori;
 * kas kazan: kalori − tdee). Düzenleme yoksa hesap sonucu aynen.
 */
export function withCustom(
  r: PpResult,
  a: { goal: PpGoal | null; weightKg: number | null; targetWeightKg: number | null },
  customCalories: number | null,
  startIso: string,
): { pace: number; weeks: number | null; date: string | null } {
  if (customCalories == null || (a.goal !== 'lose' && a.goal !== 'gain')) return { pace: r.effectivePace, weeks: r.weeks, date: r.targetDate };
  const delta = a.goal === 'lose' ? r.steps.tdee - customCalories : customCalories - r.steps.tdee;
  const pace = Math.max(0, paceForDelta(delta));
  if (!(pace > 0) || a.weightKg == null || a.targetWeightKg == null) return { pace, weeks: null, date: null };
  const weeks = Math.ceil(Math.abs(a.weightKg - a.targetWeightKg) / pace - 1e-9);
  return { pace, weeks, date: addDays(startIso, weeks * 7) };
}
