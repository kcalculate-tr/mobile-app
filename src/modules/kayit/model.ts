// G42-S1 md.2/3/9 — Yeni kayıt akışı: SAF model (RN yok → tsx --test).
//
// A yolu (kişisel plan): P1 hedef · P2 cinsiyet · P3 doğum yılı (18 altı → P3b) · P4 boy · P5 kilo · I1 ·
// P6 hedef kilo (korumak/sağlıklı beslenmekte YOK, kas kazanmakta isteğe bağlı = P6k) · P7 tempo
// (kilo vermek 0,25/0,5/0,75 · kilo almak 0,25/0,5 = P7g · kas kazanmakta YOK) · P8 gün · P9 spor ·
// P10 beslenme · I2 · P11 yemediklerin · P12 öğün sayısı · P13 mutfak · P14 zorlanma → L1 → L2.
// B yolu (kısa profil, ilk kalori kaydında): P1 · P2 · P3 · P4 · P5 · P8 → "Takibe başla".
// İlerleme halkası GÖRÜNEN soru sayısına göre: P6k atlanınca toplam bir eksilir.
import { isMinor, type PpActivity, type PpGender, type PpPace } from '../personalPlan/calc';

export type KGoal = 'lose' | 'maintain' | 'gain' | 'muscle' | 'balanced';
export const K_GOALS: readonly KGoal[] = ['lose', 'maintain', 'gain', 'muscle', 'balanced'];
export type KStart = 'track' | 'recipes' | 'community';
export const K_STARTS: readonly KStart[] = ['track', 'recipes', 'community'];
export type KPath = 'a' | 'b';
export type KUnits = 'metric' | 'imperial';
export type KDiet = 'all' | 'vegetarian' | 'vegan' | 'pescatarian';
export const K_DIETS: readonly KDiet[] = ['all', 'vegetarian', 'vegan', 'pescatarian'];
export type KCooking = 'daily' | 'sometimes' | 'ready';
export const K_COOKING: readonly KCooking[] = ['daily', 'sometimes', 'ready'];
export type KStruggle = 'evening_snack' | 'eating_out' | 'no_time' | 'sweet';
export const K_STRUGGLES: readonly KStruggle[] = ['evening_snack', 'eating_out', 'no_time', 'sweet'];
export type KSport = 'weights' | 'run' | 'walk' | 'yoga' | 'swim' | 'team' | 'other';
export const K_SPORTS: readonly KSport[] = ['weights', 'run', 'walk', 'yoga', 'swim', 'team', 'other'];
export const K_ACTIVITIES: readonly PpActivity[] = ['sedentary', 'light', 'moderate', 'active'];
/** P11 bulutunda ilk görünen etiketler (tasarım sırası); arama tüm sözlükte. */
export const K_DISLIKE_CLOUD = ['red_meat', 'chicken', 'dairy', 'egg', 'legumes', 'nuts', 'onion', 'garlic', 'spicy', 'eggplant', 'mushroom', 'fish'] as const;
/** Aramayla bulunabilen ek besinler (bulutta görünmez). */
export const K_DISLIKE_EXTRA = ['broccoli', 'olive', 'tomato', 'pepper', 'zucchini', 'cauliflower', 'spinach', 'avocado', 'seafood', 'lamb', 'turkey', 'cheese', 'yogurt', 'oats', 'rice', 'potato', 'coriander', 'parsley', 'cinnamon', 'coconut'] as const;
export type KDislike = (typeof K_DISLIKE_CLOUD)[number] | (typeof K_DISLIKE_EXTRA)[number];
export const K_DISLIKES: readonly KDislike[] = [...K_DISLIKE_CLOUD, ...K_DISLIKE_EXTRA];
/** Hafta günleri 0 = Pazartesi … 6 = Pazar. */
export type KWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const MEALS_MIN = 2;
export const MEALS_MAX = 5;

export interface KAnswers {
  goal: KGoal | null;
  gender: PpGender | null;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  units: KUnits;
  targetWeightKg: number | null;
  /** Yalnız "kas kazanmak": P6k "Atla". */
  targetSkipped: boolean;
  pace: PpPace;
  activity: PpActivity | null;
  sportDays: KWeekday[];
  noSport: boolean;
  sports: KSport[];
  diet: KDiet | null;
  dislikes: KDislike[];
  eatsAll: boolean;
  meals: number;
  cooking: KCooking | null;
  struggle: KStruggle | null;
}

export function emptyKAnswers(units: KUnits = 'metric'): KAnswers {
  return {
    goal: null,
    gender: null,
    birthYear: null,
    heightCm: null,
    weightKg: null,
    units,
    targetWeightKg: null,
    targetSkipped: false,
    pace: 0.5,
    activity: null,
    sportDays: [],
    noSport: false,
    sports: [],
    diet: null,
    dislikes: [],
    eatsAll: false,
    meals: 4,
    cooking: null,
    struggle: null,
  };
}

// ─── Adımlar ──────────────────────────────────────────────────────────────────
export type KQuestion =
  | 'goal'
  | 'gender'
  | 'birth'
  | 'height'
  | 'weight'
  | 'target'
  | 'pace'
  | 'activity'
  | 'sport'
  | 'diet'
  | 'dislikes'
  | 'meals'
  | 'cooking'
  | 'struggle';
export type KStep = KQuestion | 'i1' | 'i2' | 'minor';

/** Tasarım pano kimliği (ölçüm `reg_q_answer.q` ve ekran görüntüsü adları). */
export const PANO: Record<KQuestion, string> = {
  goal: 'P1',
  gender: 'P2',
  birth: 'P3',
  height: 'P4',
  weight: 'P5',
  target: 'P6',
  pace: 'P7',
  activity: 'P8',
  sport: 'P9',
  diet: 'P10',
  dislikes: 'P11',
  meals: 'P12',
  cooking: 'P13',
  struggle: 'P14',
};

export const A_QUESTIONS: readonly KQuestion[] = ['goal', 'gender', 'birth', 'height', 'weight', 'target', 'pace', 'activity', 'sport', 'diet', 'dislikes', 'meals', 'cooking', 'struggle'];
export const B_QUESTIONS: readonly KQuestion[] = ['goal', 'gender', 'birth', 'height', 'weight', 'activity'];

/** P6 hiç gelmez: korumak / daha sağlıklı beslenmek. */
export function targetAsked(goal: KGoal | null): boolean {
  return goal === 'lose' || goal === 'gain' || goal === 'muscle';
}
/** P6 "Atla" yalnız kas kazanmakta (P6k). */
export function targetOptional(goal: KGoal | null): boolean {
  return goal === 'muscle';
}
/** P7 yalnız kilo vermek / kilo almakta (kas kazanmakta +250 kcal sabit, tempo sorulmaz). */
export function paceAsked(goal: KGoal | null): boolean {
  return goal === 'lose' || goal === 'gain';
}
export function paceOptionsFor(goal: KGoal | null): readonly PpPace[] {
  return goal === 'gain' ? [0.25, 0.5] : [0.25, 0.5, 0.75];
}

/**
 * Halkada sayılan sorular. P6k atlandıysa toplamdan düşer (tasarım: "atlanınca ilerleme halkasının
 * toplamı bir eksilir").
 */
export function visibleQuestions(a: Pick<KAnswers, 'goal' | 'targetSkipped'>, path: KPath = 'a'): KQuestion[] {
  if (path === 'b') return [...B_QUESTIONS];
  return A_QUESTIONS.filter((q) => {
    if (q === 'target') return targetAsked(a.goal) && !(targetOptional(a.goal) && a.targetSkipped);
    if (q === 'pace') return paceAsked(a.goal);
    return true;
  });
}

/** Akış sırası (ara ekranlar dahil). P6k atlansa da sırada kalır (geri dönünce yeniden görülebilir). */
export function flowSequence(a: Pick<KAnswers, 'goal' | 'targetSkipped'>, path: KPath = 'a'): KStep[] {
  if (path === 'b') return [...B_QUESTIONS];
  const out: KStep[] = [];
  for (const q of A_QUESTIONS) {
    if (q === 'target' && !targetAsked(a.goal)) continue;
    if (q === 'pace' && !paceAsked(a.goal)) continue;
    out.push(q);
    if (q === 'weight') out.push('i1');
    if (q === 'diet') out.push('i2');
  }
  return out;
}

export type NextTarget = KStep | 'plan' | 'done';

export function nextStep(step: KStep, a: KAnswers, currentYear: number, path: KPath = 'a'): NextTarget {
  if (step === 'birth' && isMinor(a.birthYear, currentYear)) return 'minor';
  if (step === 'minor') return 'done';
  const seq = flowSequence(a, path);
  const i = seq.indexOf(step);
  if (i < 0 || i === seq.length - 1) return path === 'a' ? 'plan' : 'done';
  return seq[i + 1];
}

export function prevStep(step: KStep, a: KAnswers, path: KPath = 'a'): KStep | null {
  if (step === 'minor') return 'birth';
  const seq = flowSequence(a, path);
  const i = seq.indexOf(step);
  return i > 0 ? seq[i - 1] : null;
}

/** Halka: kaçıncı soru / toplam. Ara ekranlarda önceki sorunun sırası (dolu kalır). */
export function progressOf(step: KStep, a: KAnswers, path: KPath = 'a'): { index: number; total: number } {
  const vis = visibleQuestions(a, path);
  const total = vis.length;
  if (step === 'minor') return { index: vis.indexOf('birth') + 1, total };
  if (step === 'i1') return { index: vis.indexOf('weight') + 1, total };
  if (step === 'i2') return { index: vis.indexOf('diet') + 1, total };
  const i = vis.indexOf(step as KQuestion);
  if (i >= 0) return { index: i + 1, total };
  // Atlanmış P6k'ye geri dönüldü: halkada bir önceki sorunun sırası.
  const seq = flowSequence(a, path).filter((s): s is KQuestion => s !== 'i1' && s !== 'i2');
  const before = seq.slice(0, seq.indexOf(step as KQuestion)).filter((q) => vis.includes(q)).length;
  return { index: Math.max(1, before), total };
}

/** Devam düğmesi etkin mi (boş hâl: seçim yokken devre dışı). */
export function canContinue(step: KStep, a: KAnswers): boolean {
  switch (step) {
    case 'goal':
      return a.goal != null;
    case 'gender':
      return a.gender != null;
    case 'birth':
      return a.birthYear != null;
    case 'height':
      return a.heightCm != null && a.heightCm >= 100 && a.heightCm <= 250;
    case 'weight':
      return a.weightKg != null && a.weightKg >= 30 && a.weightKg <= 300;
    case 'target':
      return a.targetWeightKg != null && targetValidFor(a);
    case 'pace':
      return paceOptionsFor(a.goal).includes(a.pace);
    case 'activity':
      return a.activity != null;
    case 'sport':
      return true; // isteğe bağlı
    case 'diet':
      return a.diet != null;
    case 'dislikes':
      return true; // "Devam et" boş aramada da etkin
    case 'meals':
      return a.meals >= MEALS_MIN && a.meals <= MEALS_MAX;
    case 'cooking':
      return a.cooking != null;
    case 'struggle':
      return a.struggle != null;
    default:
      return true;
  }
}

/** Hedef kilo yön kuralı: kilo vermekte mevcuttan düşük, kilo almak/kas kazanmakta yüksek. */
export function targetValidFor(a: Pick<KAnswers, 'goal' | 'weightKg' | 'targetWeightKg'>): boolean {
  if (a.weightKg == null || a.targetWeightKg == null) return false;
  if (a.targetWeightKg < 30 || a.targetWeightKg > 300) return false;
  if (a.goal === 'lose') return a.targetWeightKg < a.weightKg;
  if (a.goal === 'gain' || a.goal === 'muscle') return a.targetWeightKg > a.weightKg;
  return true;
}

/** P6 açılış değeri: kilo vermek −6, kilo almak/kas kazanmak +2 (tasarım örnekleri 72 → 66 / 74). */
export function defaultTarget(goal: KGoal | null, weightKg: number): number {
  const d = goal === 'lose' ? -6 : 2;
  return Math.round((weightKg + d) * 10) / 10;
}

// ─── Birimler ─────────────────────────────────────────────────────────────────
const CM_PER_IN = 2.54;
const LB_PER_KG = 2.2046226218;

export function cmToFtIn(cm: number): { ft: number; inch: number } {
  const totalIn = Math.round(cm / CM_PER_IN);
  return { ft: Math.floor(totalIn / 12), inch: totalIn % 12 };
}
export function ftInToCm(ft: number, inch: number): number {
  return Math.round((ft * 12 + inch) * CM_PER_IN);
}
export function kgToLb(kg: number): number {
  return Math.round(kg * LB_PER_KG * 10) / 10;
}
export function lbToKg(lb: number): number {
  return Math.round((lb / LB_PER_KG) * 10) / 10;
}
/** Toplam inç ↔ cm (cetvel imperial modda inç adımlar). */
export function inchesToCm(totalIn: number): number {
  return Math.round(totalIn * CM_PER_IN);
}
export function cmToInches(cm: number): number {
  return Math.round(cm / CM_PER_IN);
}

/** İmperial (ft-in / lb) kullanan bölgeler. */
const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM', 'GB']);
/** Varsayılan birim: TR dilinde daima metrik; EN'de cihaz bölgesine göre. */
export function defaultUnits(lang: string, region: string | null | undefined): KUnits {
  if (lang !== 'en') return 'metric';
  return IMPERIAL_REGIONS.has((region ?? '').toUpperCase()) ? 'imperial' : 'metric';
}

// ─── Başlangıç kartı → ilk sekme ──────────────────────────────────────────────
export type FirstTab = 'Tracker' | 'KesfetTab';
/** Takip → Ana sayfa; Tarif ve sipariş → Keşfet; Etkinlik ve topluluk → Keşfet (Keşfet kapalıysa Ana sayfa). */
export function firstTabFor(start: KStart | null | undefined, kesfetOn: boolean): FirstTab {
  if (!kesfetOn || start == null || start === 'track') return 'Tracker';
  return 'KesfetTab';
}

/** 5. ekrandaki "Şimdi oluştur" görünür mü (kisisel_plan kapalıysa herkes B). */
export function resolvePath(choice: KPath, kisiselPlan: boolean): KPath {
  return kisiselPlan ? choice : 'b';
}

/** Öğün sayısı → ana/ara (2 → 2+0 · 3 → 3+0 · 4 → 3+1 · 5 → 3+2). */
export function mealsSplit(n: number): { main: number; snack: number } {
  const c = Math.min(MEALS_MAX, Math.max(MEALS_MIN, Math.round(n)));
  return c <= 3 ? { main: c, snack: 0 } : { main: 3, snack: c - 3 };
}

/** P11: aramada eşleşen sözlük anahtarları (Türkçe büyük/küçük harf duyarsız). */
export function searchDislikes(query: string, label: (k: KDislike) => string): KDislike[] {
  const q = query.trim().toLocaleLowerCase('tr');
  if (!q) return [...K_DISLIKE_CLOUD];
  return K_DISLIKES.filter((k) => label(k).toLocaleLowerCase('tr').includes(q));
}
